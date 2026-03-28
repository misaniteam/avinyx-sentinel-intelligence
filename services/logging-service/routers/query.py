from uuid import UUID
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from sentinel_shared.database.session import get_db
from sentinel_shared.models.log_entry import LogEntry
from sentinel_shared.auth.dependencies import require_super_admin
from sentinel_shared.schemas.log_entry import (
    LogEntryResponse,
    LogSearchResponse,
    LogStatEntry,
    LogStatsResponse,
)

logger = structlog.get_logger()
router = APIRouter()


@router.get("/search", response_model=LogSearchResponse)
async def search_logs(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
    service: str | None = None,
    level: str | None = None,
    tenant_id: UUID | None = None,
    search: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Search and filter log entries. Super admin only."""
    conditions = []

    if service:
        conditions.append(LogEntry.service == service)
    if level:
        conditions.append(LogEntry.level == level.upper())
    if tenant_id:
        conditions.append(LogEntry.tenant_id == tenant_id)
    if search:
        conditions.append(LogEntry.message.ilike(f"%{search}%"))
    if start_date:
        conditions.append(LogEntry.timestamp >= start_date)
    if end_date:
        conditions.append(LogEntry.timestamp <= end_date)

    # Count query
    count_query = select(func.count()).select_from(LogEntry)
    if conditions:
        count_query = count_query.where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Items query
    items_query = (
        select(LogEntry).order_by(desc(LogEntry.timestamp)).offset(skip).limit(limit)
    )
    if conditions:
        items_query = items_query.where(*conditions)
    result = await db.execute(items_query)
    items = result.scalars().all()

    return LogSearchResponse(
        items=[
            LogEntryResponse(
                id=item.id,
                service=item.service,
                level=item.level,
                message=item.message,
                tenant_id=item.tenant_id,
                timestamp=item.timestamp,
                context=item.context or {},
                trace_id=item.trace_id,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
    )


@router.get("/stats", response_model=LogStatsResponse)
async def log_stats(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
):
    """Aggregate log counts grouped by service and level. Super admin only."""
    conditions = []
    if start_date:
        conditions.append(LogEntry.timestamp >= start_date)
    if end_date:
        conditions.append(LogEntry.timestamp <= end_date)

    query = (
        select(
            LogEntry.service,
            LogEntry.level,
            func.count().label("count"),
        )
        .group_by(LogEntry.service, LogEntry.level)
        .order_by(desc(func.count()))
    )
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    rows = result.all()

    return LogStatsResponse(
        stats=[
            LogStatEntry(service=row.service, level=row.level, count=row.count)
            for row in rows
        ]
    )
