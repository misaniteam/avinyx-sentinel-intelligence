from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from sentinel_shared.database.session import get_db
from sentinel_shared.models.voter_list import VoterListGroup, VoterListEntry
from sentinel_shared.auth.dependencies import get_current_tenant_required, require_permissions
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


# -------------------------
# RESPONSE SCHEMAS
# -------------------------

class VoterEntryItem(BaseModel):
    id: UUID
    name: str
    father_or_husband_name: Optional[str]
    relation_type: Optional[str]
    gender: Optional[str]
    age: Optional[int]
    voter_no: Optional[str]
    serial_no: Optional[int]
    epic_no: Optional[str]
    house_number: Optional[str]
    section: Optional[str]
    status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class VoterEntryWithGroup(BaseModel):
    id: UUID
    group_id: UUID
    name: str
    father_or_husband_name: Optional[str]
    relation_type: Optional[str]
    gender: Optional[str]
    age: Optional[int]
    voter_no: Optional[str]
    serial_no: Optional[int]
    epic_no: Optional[str]
    house_number: Optional[str]
    section: Optional[str]
    status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AllVoterEntriesResponse(BaseModel):
    items: List[VoterEntryWithGroup]
    total: int


class VoterListGroupItem(BaseModel):
    id: UUID
    year: int
    constituency: str
    file_id: str
    status: str
    part_no: Optional[str]
    part_name: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    voter_count: int


class VoterListGroupsResponse(BaseModel):
    items: List[VoterListGroupItem]
    total: int


class VoterListGroupDetail(BaseModel):
    id: UUID
    year: int
    constituency: str
    file_id: str
    status: str
    part_no: Optional[str]
    part_name: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]


class VoterListGroupDetailResponse(BaseModel):
    group: VoterListGroupDetail
    entries: List[VoterEntryItem]
    total_entries: int


# -------------------------
# LIST GROUPS
# -------------------------

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
    conditions = [VoterListGroup.tenant_id == tenant_id]

    if year:
        conditions.append(VoterListGroup.year == year)

    if status:
        conditions.append(VoterListGroup.status == status)

    if search:
        conditions.append(VoterListGroup.constituency.ilike(f"%{search}%"))

    # Total count
    total = await db.scalar(
        select(func.count()).select_from(VoterListGroup).where(*conditions)
    ) or 0

    # Voter count subquery
    voter_count_subq = (
        select(
            VoterListEntry.group_id,
            func.count(VoterListEntry.id).label("voter_count"),
        )
        .group_by(VoterListEntry.group_id)
        .subquery()
    )

    query = (
        select(
            VoterListGroup,
            func.coalesce(voter_count_subq.c.voter_count, 0)
        )
        .outerjoin(voter_count_subq, VoterListGroup.id == voter_count_subq.c.group_id)
        .where(*conditions)
        .order_by(desc(VoterListGroup.created_at))
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)

    return VoterListGroupsResponse(
        items=[
            VoterListGroupItem(
                id=g.id,
                year=g.year,
                constituency=g.constituency,
                file_id=g.file_id,
                status=g.status,
                part_no=g.part_no,
                part_name=g.part_name,
                created_at=g.created_at,
                updated_at=g.updated_at,
                voter_count=count,
            )
            for g, count in result.all()
        ],
        total=total,
    )


# -------------------------
# ALL ENTRIES (across groups)
# -------------------------

@router.get("/entries/all", response_model=AllVoterEntriesResponse)
async def list_all_voter_entries(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("voters:read")),
    search: str | None = None,
    gender: str | None = None,
    status: str | None = None,
    section: str | None = None,
    group_id: UUID | None = None,
    age_min: int | None = Query(None, ge=0),
    age_max: int | None = Query(None, ge=0),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=10000),
):
    # Join with VoterListGroup for tenant isolation
    conditions = [VoterListGroup.tenant_id == tenant_id]

    if group_id:
        conditions.append(VoterListEntry.group_id == group_id)

    if age_min is not None:
        conditions.append(VoterListEntry.age >= age_min)

    if age_max is not None:
        conditions.append(VoterListEntry.age <= age_max)

    if search:
        conditions.append(
            or_(
                VoterListEntry.name.ilike(f"%{search}%"),
                VoterListEntry.epic_no.ilike(f"%{search}%"),
                VoterListEntry.voter_no.ilike(f"%{search}%"),
            )
        )

    if gender:
        conditions.append(VoterListEntry.gender == gender)

    if status:
        conditions.append(VoterListEntry.status == status)

    if section:
        conditions.append(VoterListEntry.section.ilike(f"%{section}%"))

    base_query = (
        select(VoterListEntry)
        .join(VoterListGroup, VoterListEntry.group_id == VoterListGroup.id)
        .where(*conditions)
    )

    total = await db.scalar(
        select(func.count()).select_from(base_query.subquery())
    ) or 0

    result = await db.execute(
        base_query
        .order_by(VoterListEntry.serial_no.nulls_last())
        .offset(skip)
        .limit(limit)
    )

    entries = result.scalars().all()

    return AllVoterEntriesResponse(items=entries, total=total)


# -------------------------
# GET GROUP + ENTRIES
# -------------------------

@router.get("/{group_id}", response_model=VoterListGroupDetailResponse)
async def get_voter_list_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("voters:read")),
    search: str | None = None,
    gender: str | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    # Fetch group
    group = await db.scalar(
        select(VoterListGroup).where(
            VoterListGroup.id == group_id,
            VoterListGroup.tenant_id == tenant_id,
        )
    )

    if not group:
        raise HTTPException(status_code=404, detail="Voter list group not found")

    # Entry filters
    conditions = [VoterListEntry.group_id == group_id]

    if search:
        conditions.append(
            or_(
                VoterListEntry.name.ilike(f"%{search}%"),
                VoterListEntry.voter_no.ilike(f"%{search}%"),
                VoterListEntry.epic_no.ilike(f"%{search}%"),
            )
        )

    if gender:
        conditions.append(VoterListEntry.gender == gender)

    if status:
        conditions.append(VoterListEntry.status == status)

    # Count
    total_entries = await db.scalar(
        select(func.count()).select_from(VoterListEntry).where(*conditions)
    ) or 0

    # Fetch entries
    result = await db.execute(
        select(VoterListEntry)
        .where(*conditions)
        .order_by(VoterListEntry.serial_no.nulls_last())
        .offset(skip)
        .limit(limit)
    )

    entries = result.scalars().all()

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
        entries=entries,
        total_entries=total_entries,
    )


# -------------------------
# DELETE GROUP
# -------------------------

@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voter_list_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("voters:write")),
):
    group = await db.scalar(
        select(VoterListGroup).where(
            VoterListGroup.id == group_id,
            VoterListGroup.tenant_id == tenant_id,
        )
    )

    if not group:
        raise HTTPException(status_code=404, detail="Voter list group not found")

    await db.delete(group)
    await db.commit()