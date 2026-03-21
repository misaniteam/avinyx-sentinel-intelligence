import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime

VALID_PERMISSIONS = frozenset({
    "dashboard:view", "dashboard:edit",
    "voters:read", "voters:write",
    "campaigns:read", "campaigns:write",
    "media:read", "media:write",
    "analytics:read", "analytics:export",
    "reports:read", "reports:write", "reports:export",
    "heatmap:view",
    "users:read", "users:write",
    "roles:read", "roles:write",
    "settings:read", "settings:write",
    "workers:read", "workers:manage",
    "data_sources:read", "data_sources:write",
    "notifications:read", "notifications:write",
})


def _validate_permissions(permissions: list[str]) -> list[str]:
    if len(permissions) > 50:
        raise ValueError("Maximum 50 permissions allowed per role")
    invalid = [p for p in permissions if p not in VALID_PERMISSIONS]
    if invalid:
        raise ValueError(f"Invalid permissions: {', '.join(invalid[:5])}")
    return list(set(permissions))


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role_ids: list[UUID] = []


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool | None = None
    role_ids: list[UUID] | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    is_active: bool
    is_super_admin: bool
    tenant_id: UUID | None
    created_at: datetime
    roles: list["RoleResponse"] = []

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    permissions: list[str] = Field(default=[], max_length=50)

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str]) -> list[str]:
        return _validate_permissions(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not re.match(r'^[\w\s\-]+$', v):
            raise ValueError("Name can only contain letters, numbers, spaces, underscores, and hyphens")
        return v.strip()


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    permissions: list[str] | None = Field(None, max_length=50)

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return _validate_permissions(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r'^[\w\s\-]+$', v):
            raise ValueError("Name can only contain letters, numbers, spaces, underscores, and hyphens")
        return v.strip()


class RoleResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    permissions: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
