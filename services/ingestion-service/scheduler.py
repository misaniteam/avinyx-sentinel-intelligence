import structlog
from datetime import datetime, timezone
from sqlalchemy import select, or_
from sqlalchemy.sql import text
from sentinel_shared.database.session import get_session_factory
from sentinel_shared.models.data_source import DataSource
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.config import get_settings

logger = structlog.get_logger()


async def check_and_dispatch_polls():
    """Query active data sources due for polling and dispatch SQS messages."""
    settings = get_settings()
    factory = get_session_factory()

    try:
        async with factory() as session:
            # Find data sources that are active and due for polling
            now = datetime.now(timezone.utc)
            query = select(DataSource).where(
                DataSource.is_active.is_(True),
                or_(
                    DataSource.last_polled_at.is_(None),
                    DataSource.last_polled_at
                    + text("(poll_interval_minutes * interval '1 minute')")
                    < now,
                ),
            )
            result = await session.execute(query)
            due_sources = result.scalars().all()

            if not due_sources:
                return

            sqs = SQSClient()

            for ds in due_sources:
                try:
                    # Dispatch ingestion job to SQS
                    message = {
                        "tenant_id": str(ds.tenant_id),
                        "platform": ds.platform,
                        "config": ds.config or {},
                        "since": ds.last_polled_at.isoformat()
                        if ds.last_polled_at
                        else None,
                    }
                    await sqs.send_message(settings.sqs_ingestion_queue, message)

                    # Update last_polled_at immediately to prevent double-dispatch
                    ds.last_polled_at = now

                    logger.info(
                        "poll_dispatched",
                        data_source_id=str(ds.id),
                        platform=ds.platform,
                        tenant_id=str(ds.tenant_id),
                    )
                except Exception as e:
                    logger.error(
                        "poll_dispatch_failed",
                        data_source_id=str(ds.id),
                        platform=ds.platform,
                        error=str(e),
                    )

            await session.commit()

    except Exception as e:
        logger.error("scheduler_check_failed", error=str(e))
