from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.campaign import Campaign
from sentinel_shared.auth.dependencies import get_current_tenant, require_permissions
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    target_regions: list[str] = []
    keywords: list[str] = []
    settings: dict = {}


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    target_regions: list[str] | None = None
    keywords: list[str] | None = None
    settings: dict | None = None


class CampaignResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    status: str
    start_date: datetime | None
    end_date: datetime | None
    target_regions: list
    keywords: list
    settings: dict
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("campaigns:read")),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    result = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == tenant_id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    request: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("campaigns:write")),
):
    campaign = Campaign(
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        end_date=request.end_date,
        target_regions=request.target_regions,
        keywords=request.keywords,
        settings=request.settings,
        tenant_id=tenant_id,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("campaigns:read")),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id, Campaign.tenant_id == tenant_id
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    request: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("campaigns:write")),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id, Campaign.tenant_id == tenant_id
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(require_permissions("campaigns:write")),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id, Campaign.tenant_id == tenant_id
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(campaign)
    await db.commit()
