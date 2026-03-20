from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class TenantCreate(BaseModel):
    name: str
    slug: str
    settings: dict = {}


class TenantUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    settings: dict | None = None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
    settings: dict
    created_at: datetime

    model_config = {"from_attributes": True}
