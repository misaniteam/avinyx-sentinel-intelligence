import structlog
from sqlalchemy import select, delete

from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.voter_list import VoterListGroup, VoterListEntry
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.storage.s3 import S3Client
from sentinel_shared.config import get_settings

from ocr import extract_text
from parser import parse_voter_data

logger = structlog.get_logger()

BATCH_SIZE = 500


async def process_voter_list(message: dict):
    """
    End-to-end processing:
    S3 → OCR → Parse → DB

    Guarantees:
    - No duplicate processing
    - Safe retries
    - Consistent group state
    """

    file_id = message["file_id"]
    tenant_id = message["tenant_id"]
    s3_key = message["s3_key"]
    year = message["year"]
    language = message.get("language", "en")
    part_no = message.get("part_no")
    part_name = message.get("part_name")

    tenant_context.set(tenant_id)
    factory = get_session_factory()

    logger.info(
        "processing_started",
        file_id=file_id,
        tenant_id=tenant_id,
    )

    # --------------------------------------------------
    # 1. CHECK EXISTING GROUP (idempotency)
    # --------------------------------------------------
    async with factory() as session:
        result = await session.execute(
            select(VoterListGroup).where(
                VoterListGroup.file_id == file_id,
                VoterListGroup.tenant_id == tenant_id,
            )
        )
        group = result.scalar_one_or_none()

        if group:
            if group.status == "completed":
                logger.info("already_completed", file_id=file_id)
                return

            logger.info("retry_processing_existing_group", group_id=str(group.id))
            group_id = group.id
        else:
            # Create new group
            group = VoterListGroup(
                tenant_id=tenant_id,
                year=year,
                constituency=await _get_tenant_constituency(tenant_id),
                file_id=file_id,
                status="processing",
                part_no=part_no,
                part_name=part_name,
            )
            session.add(group)
            await session.commit()
            await session.refresh(group)
            group_id = group.id

    # --------------------------------------------------
    # 2. DOWNLOAD PDF
    # --------------------------------------------------
    try:
        s3 = S3Client()
        settings = get_settings()

        if not s3_key.startswith(f"{tenant_id}/"):
            raise ValueError("Tenant mismatch in S3 key")

        logger.info("downloading_pdf", s3_key=s3_key)

        pdf_bytes = await s3.download_file(
            settings.s3_voter_docs_bucket,
            s3_key
        )

        logger.info("pdf_downloaded", size=len(pdf_bytes))

    except Exception as e:
        logger.error("download_failed", error=str(e))
        await _mark_failed(factory, group_id)
        raise

    # --------------------------------------------------
    # 3. OCR
    # --------------------------------------------------
    try:
        text = extract_text(pdf_bytes, language)

        if not text or len(text.strip()) < 100:
            raise ValueError("OCR produced insufficient text")

        logger.info("ocr_complete", chars=len(text))

    except Exception as e:
        logger.error("ocr_failed", error=str(e))
        await _mark_failed(factory, group_id)
        raise

    # --------------------------------------------------
    # 4. PARSE
    # --------------------------------------------------
    try:
        voters = parse_voter_data(text, language)

        if not voters:
            logger.warning("no_voters_parsed", file_id=file_id)

        logger.info("parsing_complete", count=len(voters))

    except Exception as e:
        logger.error("parsing_failed", error=str(e))
        await _mark_failed(factory, group_id)
        raise

    # --------------------------------------------------
    # 5. CLEAN OLD DATA (retry-safe)
    # --------------------------------------------------
    async with factory() as session:
        await session.execute(
            delete(VoterListEntry).where(
                VoterListEntry.group_id == group_id
            )
        )
        await session.commit()

    # --------------------------------------------------
    # 6. BULK INSERT
    # --------------------------------------------------
    try:
        async with factory() as session:
            for i in range(0, len(voters), BATCH_SIZE):
                batch = voters[i:i + BATCH_SIZE]

                rows = [
                    {
                        "group_id": group_id,
                        "name": v["name"],
                        "father_or_husband_name": v.get("father_or_husband_name"),
                        "relation_type": v.get("relation_type"),
                        "gender": v.get("gender"),
                        "age": v.get("age"),
                        "voter_no": v.get("voter_no"),
                        "serial_no": v.get("serial_no"),
                        "epic_no": v.get("epic_no"),
                        "house_number": v.get("house_number"),
                        "section": v.get("section"),
                        "status": v.get("status"),
                        "raw_text": v.get("raw_text"),
                    }
                    for v in batch
                    if v.get("name")
                ]

                if rows:
                    await session.execute(
                        VoterListEntry.__table__.insert(),
                        rows
                    )

            await session.commit()

        logger.info("db_insert_complete", count=len(voters))

    except Exception as e:
        logger.error("db_insert_failed", error=str(e))
        await _mark_failed(factory, group_id)
        raise

    # --------------------------------------------------
    # 7. MARK COMPLETE
    # --------------------------------------------------
    async with factory() as session:
        group = await session.get(VoterListGroup, group_id)
        group.status = "completed"
        await session.commit()

    logger.info(
        "processing_completed",
        file_id=file_id,
        group_id=str(group_id),
        total=len(voters),
    )


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

async def _mark_failed(factory, group_id):
    async with factory() as session:
        group = await session.get(VoterListGroup, group_id)
        if group:
            group.status = "failed"
            await session.commit()


async def _get_tenant_constituency(tenant_id: str) -> str:
    factory = get_session_factory()

    async with factory() as session:
        result = await session.execute(
            select(Tenant.constituency_code).where(
                Tenant.id == tenant_id
            )
        )
        code = result.scalar_one_or_none()

    if not code:
        return "unknown"

    from sentinel_shared.data.wb_constituencies import WB_CONSTITUENCY_BY_CODE

    return WB_CONSTITUENCY_BY_CODE.get(code, {}).get("name", code)