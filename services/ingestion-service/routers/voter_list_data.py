from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sentinel_shared.database.session import get_db
from sentinel_shared.models.voter_list import VoterListGroup, VoterListEntry
from sentinel_shared.auth.dependencies import get_current_tenant_required, require_permissions
from pydantic import BaseModel

router = APIRouter()


# --- Response schemas ---

class VoterListGroupItem(BaseModel):
    id: UUID
    year: int
    constituency: str
    file_id: str
    status: str
    part_no: str | None = None
    part_name: str | None = None
    created_at: datetime
    updated_at: datetime
    voter_count: int

    model_config = {"from_attributes": True}


class VoterListGroupsResponse(BaseModel):
    items: list[VoterListGroupItem]
    total: int


class VoterEntryItem(BaseModel):
    id: UUID
    name: str
    father_or_husband_name: str | None
    gender: str | None
    age: int | None
    voter_no: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VoterListGroupDetail(BaseModel):
    id: UUID
    year: int
    constituency: str
    file_id: str
    status: str
    part_no: str | None = None
    part_name: str | None = None
    created_at: datetime
    updated_at: datetime


class VoterListGroupDetailResponse(BaseModel):
    group: VoterListGroupDetail
    entries: list[VoterEntryItem]
    total_entries: int


# --- Endpoints ---

@router.get("/", response_model=VoterListGroupsResponse)
async def list_voter_list_groups(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("voters:read")),
    year: int | None = None,
    status: str | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List voter list groups with voter counts."""
    conditions = [VoterListGroup.tenant_id == tenant_id]

    if year:
        conditions.append(VoterListGroup.year == year)
    if status:
        conditions.append(VoterListGroup.status == status)
    if search:
        conditions.append(VoterListGroup.constituency.ilike(f"%{search}%"))

    # Count query
    count_query = select(func.count()).select_from(VoterListGroup).where(*conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Subquery for voter count per group
    voter_count_subq = (
        select(
            VoterListEntry.group_id,
            func.count(VoterListEntry.id).label("voter_count"),
        )
        .group_by(VoterListEntry.group_id)
        .subquery()
    )

    # Items query with voter count
    items_query = (
        select(
            VoterListGroup,
            func.coalesce(voter_count_subq.c.voter_count, 0).label("voter_count"),
        )
        .outerjoin(voter_count_subq, VoterListGroup.id == voter_count_subq.c.group_id)
        .where(*conditions)
        .order_by(desc(VoterListGroup.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(items_query)
    rows = result.all()

    return VoterListGroupsResponse(
        items=[
            VoterListGroupItem(
                id=group.id,
                year=group.year,
                constituency=group.constituency,
                file_id=group.file_id,
                status=group.status,
                part_no=group.part_no,
                part_name=group.part_name,
                created_at=group.created_at,
                updated_at=group.updated_at,
                voter_count=voter_count,
            )
            for group, voter_count in rows
        ],
        total=total,
    )


@router.get("/{group_id}", response_model=VoterListGroupDetailResponse)
async def get_voter_list_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("voters:read")),
    search: str | None = None,
    gender: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get a voter list group with paginated voter entries."""
    # Fetch group (with tenant isolation)
    group_query = select(VoterListGroup).where(
        VoterListGroup.id == group_id,
        VoterListGroup.tenant_id == tenant_id,
    )
    result = await db.execute(group_query)
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(status_code=404, detail="Voter list group not found")

    # Build entry filter conditions
    entry_conditions = [VoterListEntry.group_id == group_id]

    if search:
        entry_conditions.append(
            (VoterListEntry.name.ilike(f"%{search}%"))
            | (VoterListEntry.voter_no.ilike(f"%{search}%"))
        )
    if gender:
        entry_conditions.append(VoterListEntry.gender == gender)

    # Count entries
    count_query = select(func.count()).select_from(VoterListEntry).where(*entry_conditions)
    total_result = await db.execute(count_query)
    total_entries = total_result.scalar() or 0

    # Fetch entries
    entries_query = (
        select(VoterListEntry)
        .where(*entry_conditions)
        .order_by(VoterListEntry.created_at)
        .offset(skip)
        .limit(limit)
    )
    entries_result = await db.execute(entries_query)
    entries = entries_result.scalars().all()

    return VoterListGroupDetailResponse(
        group=VoterListGroupDetail(
            id=group.id,
            year=group.year,
            constituency=group.constituency,
            file_id=group.file_id,
            status=group.status,
            part_no=group.part_no,
            part_name=group.part_name,
            created_at=group.created_at,
            updated_at=group.updated_at,
        ),
        entries=[
            VoterEntryItem(
                id=entry.id,
                name=entry.name,
                father_or_husband_name=entry.father_or_husband_name,
                gender=entry.gender,
                age=entry.age,
                voter_no=entry.voter_no,
                created_at=entry.created_at,
            )
            for entry in entries
        ],
        total_entries=total_entries,
    )
