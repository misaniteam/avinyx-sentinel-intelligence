from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sentinel_shared.database.session import get_db
from sentinel_shared.models.role import Role
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)
from sentinel_shared.schemas.user import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter()


async def _get_role_or_404(db: AsyncSession, role_id: UUID, tenant_id: str) -> Role:
    result = await db.execute(
        select(Role).where(Role.id == role_id, Role.tenant_id == tenant_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    return role


async def _check_name_unique(
    db: AsyncSession, tenant_id: str, name: str, exclude_id: UUID | None = None
) -> None:
    query = (
        select(func.count())
        .select_from(Role)
        .where(Role.tenant_id == tenant_id, Role.name == name)
    )
    if exclude_id:
        query = query.where(Role.id != exclude_id)
    result = await db.execute(query)
    if result.scalar_one() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A role named '{name}' already exists",
        )


@router.get("/", response_model=list[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("roles:read")),
):
    result = await db.execute(select(Role).where(Role.tenant_id == tenant_id))
    return result.scalars().all()


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: RoleCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("roles:write")),
):
    await _check_name_unique(db, tenant_id, request.name)
    role = Role(
        name=request.name,
        description=request.description,
        permissions=request.permissions,
        tenant_id=tenant_id,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("roles:read")),
):
    return await _get_role_or_404(db, role_id, tenant_id)


@router.patch("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    request: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("roles:write")),
):
    role = await _get_role_or_404(db, role_id, tenant_id)

    update_data = request.model_dump(exclude_unset=True)
    if "name" in update_data:
        await _check_name_unique(db, tenant_id, update_data["name"], exclude_id=role_id)
        role.name = update_data["name"]
    if "description" in update_data:
        role.description = update_data["description"]
    if "permissions" in update_data:
        role.permissions = update_data["permissions"]

    await db.commit()
    await db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("roles:write")),
):
    role = await _get_role_or_404(db, role_id, tenant_id)
    await db.delete(role)
    await db.commit()
