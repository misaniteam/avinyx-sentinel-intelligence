from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sentinel_shared.database.session import get_db
from sentinel_shared.models.user import User
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from sentinel_shared.auth.password import hash_password, verify_password
from sentinel_shared.schemas.auth import (
    LoginRequest,
    TokenResponse,
    SetupRequest,
    RefreshRequest,
)

router = APIRouter()


@router.get("/setup-status")
async def setup_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count()).select_from(User).where(User.is_super_admin.is_(True))
    )
    count = result.scalar()
    return {"setup_required": count == 0}


@router.post("/setup", response_model=TokenResponse)
async def setup(request: SetupRequest, db: AsyncSession = Depends(get_db)):
    # Check if super admin already exists
    result = await db.execute(
        select(func.count()).select_from(User).where(User.is_super_admin.is_(True))
    )
    if result.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Setup already completed"
        )

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        is_super_admin=True,
        tenant_id=None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token_data = {
        "sub": str(user.id),
        "tenant_id": None,
        "is_super_admin": True,
        "roles": [],
        "permissions": ["*"],
    }
    return TokenResponse(access_token=create_access_token(token_data))


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled"
        )

    # Collect permissions from roles
    permissions = set()
    role_names = []
    for role in user.roles:
        role_names.append(role.name)
        permissions.update(role.permissions or [])

    if user.is_super_admin:
        permissions = {"*"}

    # Look up constituency_code from tenant
    constituency_code = None
    if user.tenant_id:
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == user.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            constituency_code = tenant.constituency_code

    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "is_super_admin": user.is_super_admin,
        "roles": role_names,
        "permissions": list(permissions),
        "constituency_code": constituency_code,
    }
    access_token = create_access_token(token_data)
    # TODO: refresh_token would typically go in httpOnly cookie
    _refresh_token = create_refresh_token(token_data)  # noqa: F841
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Re-fetch user to get current roles
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    permissions = set()
    role_names = []
    for role in user.roles:
        role_names.append(role.name)
        permissions.update(role.permissions or [])
    if user.is_super_admin:
        permissions = {"*"}

    # Look up constituency_code from tenant
    constituency_code = None
    if user.tenant_id:
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == user.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            constituency_code = tenant.constituency_code

    token_data = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "is_super_admin": user.is_super_admin,
        "roles": role_names,
        "permissions": list(permissions),
        "constituency_code": constituency_code,
    }
    return TokenResponse(access_token=create_access_token(token_data))
