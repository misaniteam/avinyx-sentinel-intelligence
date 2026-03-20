from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.auth.dependencies import get_current_tenant_required, require_permissions
from sentinel_shared.models.tenant import Tenant
from pydantic import BaseModel, field_validator
from typing import Any

router = APIRouter()

ALLOWED_SETTINGS_KEYS = {"ai", "notifications", "general"}


class TenantSettingsUpdate(BaseModel):
    settings: dict[str, Any]

    @field_validator("settings")
    @classmethod
    def validate_keys(cls, v: dict) -> dict:
        invalid = set(v.keys()) - ALLOWED_SETTINGS_KEYS
        if invalid:
            raise ValueError(f"Unknown settings keys: {invalid}")
        return v


def _mask_settings(settings: dict) -> dict:
    """Mask sensitive fields before returning settings to the client."""
    if "ai" in settings and isinstance(settings["ai"], dict) and "api_key" in settings["ai"]:
        settings = {**settings, "ai": {**settings["ai"], "api_key": "****"}}
    return settings


@router.get(
    "/",
    dependencies=[Depends(require_permissions("settings:read"))],
)
async def get_tenant_settings(
    tenant_id: str = Depends(get_current_tenant_required),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    settings = tenant.settings or {}
    return {"settings": _mask_settings(settings)}


@router.patch(
    "/",
    dependencies=[Depends(require_permissions("settings:write"))],
)
async def update_tenant_settings(
    data: TenantSettingsUpdate,
    tenant_id: str = Depends(get_current_tenant_required),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    # Merge settings
    current = tenant.settings or {}
    current.update(data.settings)
    tenant.settings = current
    await db.commit()
    return {"settings": _mask_settings(tenant.settings)}
