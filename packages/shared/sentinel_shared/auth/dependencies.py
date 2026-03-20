from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sentinel_shared.auth.jwt_handler import decode_token
from sentinel_shared.database.session import tenant_context

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return payload


async def get_current_tenant(user: dict = Depends(get_current_user)) -> str | None:
    tenant_id = user.get("tenant_id")
    if tenant_id:
        tenant_context.set(tenant_id)
    return tenant_id


def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return user


def require_permissions(*permissions: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        user_permissions = set(user.get("permissions", []))
        if "*" in user_permissions:
            return user
        if not all(p in user_permissions for p in permissions):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return checker


async def get_current_tenant_required(
    tenant_id: str | None = Depends(get_current_tenant),
) -> str:
    if tenant_id is None:
        raise HTTPException(
            status_code=400,
            detail="Tenant context required. Super admins must specify a tenant.",
        )
    return tenant_id
