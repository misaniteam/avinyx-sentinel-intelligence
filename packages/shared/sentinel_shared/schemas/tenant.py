from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime


class TenantCreate(BaseModel):
    name: str
    slug: str
    constituency_code: str = Field(..., max_length=10)
    settings: dict = {}

    @field_validator("constituency_code")
    @classmethod
    def validate_constituency_code(cls, v: str) -> str:
        from sentinel_shared.data.wb_constituencies import WB_CONSTITUENCY_CODES

        if v not in WB_CONSTITUENCY_CODES:
            raise ValueError(f"Invalid constituency code: {v}")
        return v


class TenantUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    settings: dict | None = None
    constituency_code: str | None = None

    @field_validator("constituency_code")
    @classmethod
    def validate_constituency_code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from sentinel_shared.data.wb_constituencies import WB_CONSTITUENCY_CODES

        if v not in WB_CONSTITUENCY_CODES:
            raise ValueError(f"Invalid constituency code: {v}")
        return v


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
    settings: dict
    constituency_code: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
