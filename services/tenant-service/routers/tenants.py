from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.models.role import Role
from sentinel_shared.models.user import User
from sentinel_shared.auth.dependencies import require_super_admin
from sentinel_shared.auth.password import hash_password
from sentinel_shared.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse
from sentinel_shared.data.wb_constituencies import (
    WB_CONSTITUENCIES,
)
from pydantic import BaseModel, EmailStr

router = APIRouter()


class TenantOnboardRequest(BaseModel):
    tenant: TenantCreate
    admin_email: EmailStr
    admin_password: str
    admin_name: str


class TenantOnboardResponse(BaseModel):
    tenant: TenantResponse
    admin_user_id: UUID


@router.get("/constituencies")
async def list_constituencies(
    user: dict = Depends(require_super_admin),
):
    return WB_CONSTITUENCIES


@router.get("/constituencies/available")
async def list_available_constituencies(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    result = await db.execute(
        select(Tenant.constituency_code).where(Tenant.constituency_code.isnot(None))
    )
    assigned_codes = {row[0] for row in result.all()}
    return [c for c in WB_CONSTITUENCIES if c["code"] not in assigned_codes]


@router.get("/", response_model=list[TenantResponse])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    result = await db.execute(select(Tenant).offset(skip).limit(limit))
    return result.scalars().all()


@router.post(
    "/", response_model=TenantOnboardResponse, status_code=status.HTTP_201_CREATED
)
async def create_tenant(
    request: TenantOnboardRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    # Check slug uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.slug == request.tenant.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Tenant slug already exists"
        )

    # Check constituency uniqueness
    if request.tenant.constituency_code:
        existing_constituency = await db.execute(
            select(Tenant).where(
                Tenant.constituency_code == request.tenant.constituency_code
            )
        )
        if existing_constituency.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Constituency is already assigned to another tenant",
            )

    # Create tenant
    tenant = Tenant(
        name=request.tenant.name,
        slug=request.tenant.slug,
        constituency_code=request.tenant.constituency_code,
        settings=request.tenant.settings,
    )
    db.add(tenant)
    await db.flush()

    # Create default admin role with all permissions
    admin_role = Role(
        name="Tenant Admin",
        description="Full access to all tenant resources",
        permissions=[
            "dashboard:view",
            "dashboard:edit",
            "voters:read",
            "voters:write",
            "campaigns:read",
            "campaigns:write",
            "media:read",
            "media:write",
            "analytics:read",
            "analytics:export",
            "reports:read",
            "reports:write",
            "reports:export",
            "heatmap:view",
            "users:read",
            "users:write",
            "roles:read",
            "roles:write",
            "settings:read",
            "settings:write",
            "workers:read",
            "workers:manage",
            "data_sources:read",
            "data_sources:write",
            "notifications:read",
            "notifications:write",
            "topics:read",
            "topics:write",
        ],
        tenant_id=tenant.id,
    )
    db.add(admin_role)
    await db.flush()

    # Create admin user
    admin_user = User(
        email=request.admin_email,
        password_hash=hash_password(request.admin_password),
        full_name=request.admin_name,
        tenant_id=tenant.id,
        is_active=True,
    )
    admin_user.roles = [admin_role]
    db.add(admin_user)

    await db.commit()
    await db.refresh(tenant)
    await db.refresh(admin_user)

    return TenantOnboardResponse(tenant=tenant, admin_user_id=admin_user.id)


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    request: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )

    update_data = request.model_dump(exclude_unset=True)

    # Check constituency uniqueness if changing
    if (
        "constituency_code" in update_data
        and update_data["constituency_code"] is not None
    ):
        existing = await db.execute(
            select(Tenant).where(
                Tenant.constituency_code == update_data["constituency_code"],
                Tenant.id != tenant_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Constituency is already assigned to another tenant",
            )

    if "name" in update_data:
        tenant.name = update_data["name"]
    if "status" in update_data:
        tenant.status = update_data["status"]
    if "settings" in update_data:
        tenant.settings = update_data["settings"]
    if "constituency_code" in update_data:
        tenant.constituency_code = update_data["constituency_code"]

    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    await db.delete(tenant)
    await db.commit()
