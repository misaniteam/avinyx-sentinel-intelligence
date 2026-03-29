from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Float
from sentinel_shared.database.session import get_db
from sentinel_shared.models.media import RawMediaItem, SentimentAnalysis
from sentinel_shared.models.voter_list import VoterListGroup, VoterListEntry
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)

router = APIRouter()


@router.get("/data")
async def heatmap_data(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("heatmap:view")),
    sentiment_filter: str | None = Query(None, pattern="^(positive|negative|neutral)$"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(5000, le=10000),
):
    query = (
        select(
            RawMediaItem.geo_lat,
            RawMediaItem.geo_lng,
            SentimentAnalysis.sentiment_score,
        )
        .join(SentimentAnalysis, SentimentAnalysis.media_item_id == RawMediaItem.id)
        .where(
            RawMediaItem.tenant_id == tenant_id,
            SentimentAnalysis.tenant_id == tenant_id,
            RawMediaItem.geo_lat.isnot(None),
            RawMediaItem.geo_lng.isnot(None),
        )
    )

    if sentiment_filter:
        query = query.where(SentimentAnalysis.sentiment_label == sentiment_filter)
    if date_from:
        query = query.where(RawMediaItem.published_at >= date_from)
    if date_to:
        query = query.where(RawMediaItem.published_at <= date_to)

    query = query.limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "lat": row.geo_lat,
            "lng": row.geo_lng,
            "weight": (row.sentiment_score + 1) / 2,
        }
        for row in rows
    ]


# -------------------------
# VOTER LOCATION STATS
# -------------------------


class VoterLocationStatsItem(BaseModel):
    group_id: UUID
    location_name: Optional[str]
    part_no: Optional[str]
    part_name: Optional[str]
    lat: float
    lng: float
    status: str
    year: int
    total_count: int
    male_count: int
    female_count: int
    other_gender_count: int
    average_age: Optional[float]
    status_counts: dict[str, int]


@router.get("/voter-location-stats", response_model=list[VoterLocationStatsItem])
async def voter_location_stats(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("heatmap:view")),
):
    """Aggregate voter entry stats per VoterListGroup that has location coordinates."""

    # Get all groups with location for this tenant (any status)
    groups_result = await db.execute(
        select(VoterListGroup).where(
            VoterListGroup.tenant_id == tenant_id,
            VoterListGroup.location_lat.isnot(None),
            VoterListGroup.location_lng.isnot(None),
        )
    )
    groups = groups_result.scalars().all()

    if not groups:
        return []

    group_ids = [g.id for g in groups]
    group_map = {g.id: g for g in groups}

    # Aggregate stats per group in a single query
    stats_query = (
        select(
            VoterListEntry.group_id,
            func.count(VoterListEntry.id).label("total_count"),
            func.sum(
                case((func.lower(VoterListEntry.gender) == "male", 1), else_=0)
            ).label("male_count"),
            func.sum(
                case((func.lower(VoterListEntry.gender) == "female", 1), else_=0)
            ).label("female_count"),
            func.sum(
                case(
                    (
                        func.lower(VoterListEntry.gender).notin_(["male", "female"]),
                        1,
                    ),
                    else_=0,
                )
            ).label("other_gender_count"),
            func.avg(cast(VoterListEntry.age, Float)).label("average_age"),
        )
        .where(VoterListEntry.group_id.in_(group_ids))
        .group_by(VoterListEntry.group_id)
    )

    stats_result = await db.execute(stats_query)
    stats_rows = {row.group_id: row for row in stats_result.all()}

    # Status counts per group
    status_query = (
        select(
            VoterListEntry.group_id,
            VoterListEntry.status,
            func.count(VoterListEntry.id).label("cnt"),
        )
        .where(
            VoterListEntry.group_id.in_(group_ids),
            VoterListEntry.status.isnot(None),
            VoterListEntry.status != "",
        )
        .group_by(VoterListEntry.group_id, VoterListEntry.status)
    )

    status_result = await db.execute(status_query)
    status_map: dict[UUID, dict[str, int]] = {}
    for row in status_result.all():
        status_map.setdefault(row.group_id, {})[row.status] = row.cnt

    items = []
    for gid, group in group_map.items():
        stats = stats_rows.get(gid)

        items.append(
            VoterLocationStatsItem(
                group_id=gid,
                location_name=group.location_name,
                part_no=group.part_no,
                part_name=group.part_name,
                lat=group.location_lat,
                lng=group.location_lng,
                status=group.status,
                year=group.year,
                total_count=stats.total_count if stats else 0,
                male_count=stats.male_count if stats else 0,
                female_count=stats.female_count if stats else 0,
                other_gender_count=stats.other_gender_count if stats else 0,
                average_age=round(stats.average_age, 1) if stats and stats.average_age else None,
                status_counts=status_map.get(gid, {}),
            )
        )

    return items
