from uuid import UUID
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LogEntryCreate(BaseModel):
    service: str = Field(..., max_length=100)
    level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    message: str = Field(..., max_length=10000)
    tenant_id: UUID | None = None
    timestamp: datetime
    context: dict = {}
    trace_id: str | None = None

    model_config = {"extra": "forbid"}


class LogBatchCreate(BaseModel):
    entries: list[LogEntryCreate] = Field(..., max_length=100)


class LogEntryResponse(BaseModel):
    id: UUID
    service: str
    level: str
    message: str
    tenant_id: UUID | None
    timestamp: datetime
    context: dict
    trace_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LogSearchResponse(BaseModel):
    items: list[LogEntryResponse]
    total: int


class LogStatEntry(BaseModel):
    service: str
    level: str
    count: int


class LogStatsResponse(BaseModel):
    stats: list[LogStatEntry]
