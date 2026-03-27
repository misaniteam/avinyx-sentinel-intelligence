import structlog
from sqlalchemy import select, delete, update

from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.voter_list import VoterListGroup, VoterListEntry
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.storage.s3 import S3Client
from sentinel_shared.config import get_settings

from textract_extractor import extract_voters_from_pdf

logger = structlog.get_logger()

BATCH_SIZE = 500


async def process_voter_list(message: dict):
    """
    End-to-end processing:
    S3 → Textract OCR + parse → DB

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
    location_name = message.get("location_name")
    location_lat = message.get("location_lat")
    location_lng = message.get("location_lng")

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
                location_name=location_name,
                location_lat=location_lat,
                location_lng=location_lng,
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
    # 3. CLEAN OLD DATA (retry-safe)
    # --------------------------------------------------
    async with factory() as session:
        await session.execute(
            delete(VoterListEntry).where(
                VoterListEntry.group_id == group_id
            )
        )
        await session.commit()

    # --------------------------------------------------
    # 4. LOAD EXISTING EPICs (cross-upload dedup)
    # --------------------------------------------------
    existing_epics: set[str] = set()
    async with factory() as session:
        # All EPICs for this tenant across all groups
        tenant_groups = select(VoterListGroup.id).where(
            VoterListGroup.tenant_id == tenant_id
        )
        result = await session.execute(
            select(VoterListEntry.epic_no).where(
                VoterListEntry.group_id.in_(tenant_groups),
                VoterListEntry.epic_no.isnot(None),
                VoterListEntry.epic_no != "",
            )
        )
        existing_epics = {row[0] for row in result.all()}

    if existing_epics:
        logger.info("existing_epics_loaded", count=len(existing_epics))

    # --------------------------------------------------
    # 5. EXTRACT + INSERT PER CHUNK
    # --------------------------------------------------
    total_inserted = 0

    try:
        async for chunk_voters in extract_voters_from_pdf(pdf_bytes, language):
            if not chunk_voters:
                continue

            # Filter out voters whose EPIC already exists in other groups
            chunk_voters = [
                v for v in chunk_voters
                if not v.get("epic_no") or v["epic_no"] not in existing_epics
            ]
            if not chunk_voters:
                logger.info("chunk_all_duplicates_skipped")
                continue

            # Insert this chunk to DB immediately
            try:
                # Separate new inserts from replacements (overlap upgrades with EPIC)
                to_insert = [v for v in chunk_voters if v.get("name") and not v.get("_replace_serial")]
                to_update = [v for v in chunk_voters if v.get("_replace_serial")]

                async with factory() as session:
                    # Insert new entries
                    for i in range(0, len(to_insert), BATCH_SIZE):
                        batch = to_insert[i:i + BATCH_SIZE]
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
                        ]
                        if rows:
                            await session.execute(
                                VoterListEntry.__table__.insert(),
                                rows
                            )

                    # Update entries where a better version was found in overlap
                    for v in to_update:
                        await session.execute(
                            update(VoterListEntry)
                            .where(
                                VoterListEntry.group_id == group_id,
                                VoterListEntry.serial_no == v.get("serial_no"),
                            )
                            .values(epic_no=v.get("epic_no"))
                        )
                        if to_update:
                            logger.info("overlap_epic_updated", count=len(to_update))

                    await session.commit()

                # Track inserted EPICs to prevent cross-upload duplicates
                for v in chunk_voters:
                    if v.get("epic_no"):
                        existing_epics.add(v["epic_no"])

                total_inserted += len(to_insert)
                logger.info("db_chunk_inserted", chunk_voters=len(to_insert), updated=len(to_update), total_so_far=total_inserted)

            except Exception as e:
                logger.error("db_chunk_insert_failed", error=str(e), total_saved=total_inserted)
                # Continue processing remaining chunks — already-saved data is preserved

    except Exception as e:
        logger.error("extraction_failed", error=str(e), total_saved=total_inserted)
        if total_inserted == 0:
            await _mark_failed(factory, group_id)
            raise

    if total_inserted == 0:
        logger.warning("no_voters_extracted", file_id=file_id)

    # --------------------------------------------------
    # 5. MARK COMPLETE
    # --------------------------------------------------
    async with factory() as session:
        group = await session.get(VoterListGroup, group_id)
        group.status = "completed"
        await session.commit()

    logger.info(
        "processing_completed",
        file_id=file_id,
        group_id=str(group_id),
        total=total_inserted,
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