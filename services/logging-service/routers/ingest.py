import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_shared.database.session import get_db
from sentinel_shared.models.log_entry import LogEntry
from sentinel_shared.schemas.log_entry import LogBatchCreate

logger = structlog.get_logger()
router = APIRouter()


@router.post("/ingest")
async def ingest_logs(
    batch: LogBatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """Receive a batch of log entries from services. Internal-only, no auth."""
    entries = []
    for entry in batch.entries:
        log_entry = LogEntry(
            service=entry.service,
            level=entry.level,
            message=entry.message,
            tenant_id=entry.tenant_id,
            timestamp=entry.timestamp,
            context=entry.context,
            trace_id=entry.trace_id,
        )
        entries.append(log_entry)

    db.add_all(entries)
    await db.commit()

    return {"accepted": len(entries)}
