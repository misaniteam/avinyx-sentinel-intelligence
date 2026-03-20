from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.voter import Voter, VoterInteraction
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class VoterCreate(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    geo_lat: float | None = None
    geo_lng: float | None = None
    geo_region: str | None = None
    demographics: dict = {}
    tags: list[str] = []

class VoterUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    geo_lat: float | None = None
    geo_lng: float | None = None
    geo_region: str | None = None
    demographics: dict | None = None
    sentiment_score: float | None = None
    tags: list[str] | None = None

class VoterResponse(BaseModel):
    id: UUID
    full_name: str
    email: str | None
    phone: str | None
    geo_lat: float | None
    geo_lng: float | None
    geo_region: str | None
    demographics: dict
    sentiment_score: float | None
    tags: list
    created_at: datetime

    model_config = {"from_attributes": True}

class InteractionCreate(BaseModel):
    campaign_id: UUID | None = None
    interaction_type: str
    notes: str | None = None
    metadata: dict = {}

class InteractionResponse(BaseModel):
    id: UUID
    voter_id: UUID
    campaign_id: UUID | None
    interaction_type: str
    notes: str | None
    metadata: dict
    created_at: datetime

    model_config = {"from_attributes": True}

@router.get("/", response_model=list[VoterResponse])
async def list_voters(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    region: str | None = None,
    tag: str | None = None,
):
    query = select(Voter).where(Voter.tenant_id == tenant_id)
    if region:
        query = query.where(Voter.geo_region == region)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=VoterResponse, status_code=status.HTTP_201_CREATED)
async def create_voter(
    request: VoterCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:write")),
):
    voter = Voter(
        full_name=request.full_name,
        email=request.email,
        phone=request.phone,
        geo_lat=request.geo_lat,
        geo_lng=request.geo_lng,
        geo_region=request.geo_region,
        demographics=request.demographics,
        tags=request.tags,
        tenant_id=tenant_id,
    )
    db.add(voter)
    await db.commit()
    await db.refresh(voter)
    return voter

@router.get("/{voter_id}", response_model=VoterResponse)
async def get_voter(
    voter_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:read")),
):
    result = await db.execute(select(Voter).where(Voter.id == voter_id, Voter.tenant_id == tenant_id))
    voter = result.scalar_one_or_none()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    return voter

@router.patch("/{voter_id}", response_model=VoterResponse)
async def update_voter(
    voter_id: UUID,
    request: VoterUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:write")),
):
    result = await db.execute(select(Voter).where(Voter.id == voter_id, Voter.tenant_id == tenant_id))
    voter = result.scalar_one_or_none()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(voter, key, value)
    await db.commit()
    await db.refresh(voter)
    return voter

@router.delete("/{voter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voter(
    voter_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:write")),
):
    result = await db.execute(select(Voter).where(Voter.id == voter_id, Voter.tenant_id == tenant_id))
    voter = result.scalar_one_or_none()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    await db.delete(voter)
    await db.commit()

@router.get("/{voter_id}/interactions", response_model=list[InteractionResponse])
async def list_voter_interactions(
    voter_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:read")),
):
    result = await db.execute(
        select(VoterInteraction).where(VoterInteraction.voter_id == voter_id, VoterInteraction.tenant_id == tenant_id)
    )
    return result.scalars().all()

@router.post("/{voter_id}/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def create_voter_interaction(
    voter_id: UUID,
    request: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("voters:write")),
):
    interaction = VoterInteraction(
        voter_id=voter_id,
        campaign_id=request.campaign_id,
        interaction_type=request.interaction_type,
        notes=request.notes,
        metadata=request.metadata,
        tenant_id=tenant_id,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return interaction
