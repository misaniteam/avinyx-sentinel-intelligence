import structlog
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from sqlalchemy import delete

from sentinel_shared.logging import init_logging
from sentinel_shared.database.session import get_session_factory
from sentinel_shared.models.log_entry import LogEntry
from routers import ingest_router, query_router

logger = structlog.get_logger()


async def purge_old_logs():
    """Delete log entries older than 30 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            delete(LogEntry).where(LogEntry.timestamp < cutoff)
        )
        await session.commit()
        deleted = result.rowcount
        if deleted > 0:
            logger.info("logs_purged", deleted_count=deleted, cutoff=cutoff.isoformat())


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No log shipping for logging-service itself (prevents infinite loop)
    init_logging("logging-service")
    logger.info("logging-service starting")

    # Schedule daily log purge
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    scheduler = AsyncIOScheduler()
    scheduler.add_job(purge_old_logs, "interval", hours=24)
    scheduler.start()

    yield

    scheduler.shutdown()
    logger.info("logging-service shutting down")


app = FastAPI(title="Logging Service", lifespan=lifespan)
app.include_router(ingest_router, prefix="/logs", tags=["log-ingest"])
app.include_router(query_router, prefix="/logs", tags=["log-query"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "logging-service"}
