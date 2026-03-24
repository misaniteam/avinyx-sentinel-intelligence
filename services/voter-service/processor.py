import structlog
from sqlalchemy import select
from sentinel_shared.config import get_settings
from sentinel_shared.storage.s3 import S3Client
from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.models.voter_list import VoterListGroup, VoterListEntry
from sentinel_shared.data.wb_constituencies import WB_CONSTITUENCY_BY_CODE
from ocr import extract_text
from parser import parse_voter_data

logger = structlog.get_logger()


async def process_voter_list(message: dict):
    """Process a voter list PDF: download from S3, extract text, parse, store in DB."""
    file_id = message["file_id"]
    s3_key = message["s3_key"]
    year = message["year"]
    language = message.get("language", "en")
    tenant_id = message["tenant_id"]

    tenant_context.set(tenant_id)
    logger.info("processing_voter_list", file_id=file_id, s3_key=s3_key, year=year, language=language, tenant_id=tenant_id)

    # Create group record with processing status
    factory = get_session_factory()
    constituency = await _get_tenant_constituency(tenant_id)

    async with factory() as session:
        group = VoterListGroup(
            tenant_id=tenant_id,
            year=year,
            constituency=constituency,
            file_id=file_id,
            status="processing",
        )
        session.add(group)
        await session.commit()
        await session.refresh(group)
        group_id = group.id

    try:
        # Download PDF from S3
        s3 = S3Client()
        settings = get_settings()

        # Validate S3 key belongs to this tenant
        if not s3_key.startswith(f"{tenant_id}/"):
            raise ValueError(f"S3 key tenant mismatch: {s3_key} does not belong to tenant {tenant_id}")

        pdf_bytes = await s3.download_file(settings.s3_voter_docs_bucket, s3_key)
        logger.info("pdf_downloaded", s3_key=s3_key, size=len(pdf_bytes))

        # Extract text (pdfplumber with OCR fallback)
        text = extract_text(pdf_bytes, language)
        if not text or not text.strip():
            raise ValueError("No text could be extracted from the PDF")
        logger.info("text_extracted", chars=len(text))

        # Parse voter records
        voters = parse_voter_data(text, language)
        logger.info("voters_parsed", count=len(voters))

        if not voters:
            logger.warning("no_voters_found", file_id=file_id, s3_key=s3_key)

        # Store voter entries
        async with factory() as session:
            for v in voters:
                entry = VoterListEntry(
                    group_id=group_id,
                    name=v["name"],
                    father_or_husband_name=v.get("father_or_husband_name"),
                    gender=v.get("gender"),
                    age=v.get("age"),
                    voter_no=v.get("voter_no"),
                )
                session.add(entry)
            await session.commit()

        # Update group status to completed
        async with factory() as session:
            group = await session.get(VoterListGroup, group_id)
            group.status = "completed"
            await session.commit()

        logger.info("voter_list_processed", file_id=file_id, group_id=str(group_id), voter_count=len(voters))

    except Exception as e:
        logger.error("voter_list_processing_failed", file_id=file_id, error=str(e))
        # Update group status to failed
        async with factory() as session:
            group = await session.get(VoterListGroup, group_id)
            if group:
                group.status = "failed"
                await session.commit()
        raise


async def _get_tenant_constituency(tenant_id: str) -> str:
    """Look up the tenant's constituency name. Returns code if no match found."""
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(Tenant.constituency_code).where(Tenant.id == tenant_id)
        )
        constituency_code = result.scalar_one_or_none()

    if constituency_code:
        constituency = WB_CONSTITUENCY_BY_CODE.get(constituency_code)
        if constituency:
            return constituency["name"]
        return constituency_code

    return "unknown"
