from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Literal

VALID_SENTIMENT_DIRECTIONS = ("positive", "negative", "neutral")


class TopicKeywordCreate(BaseModel):
    model_config = {"extra": "forbid"}

    name: str = Field(..., min_length=1, max_length=255)
    keywords: list[str] = Field(default_factory=list)
    sentiment_direction: Literal["positive", "negative", "neutral"]
    category: str | None = Field(default=None, max_length=100)
    is_active: bool = True

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, v: list[str]) -> list[str]:
        if len(v) > 100:
            raise ValueError("Maximum 100 keywords allowed per topic")
        cleaned = []
        for kw in v:
            kw = kw.strip()
            if kw and len(kw) <= 255:
                cleaned.append(kw)
        return cleaned

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()


class TopicKeywordUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    name: str | None = Field(default=None, min_length=1, max_length=255)
    keywords: list[str] | None = None
    sentiment_direction: Literal["positive", "negative", "neutral"] | None = None
    category: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if len(v) > 100:
            raise ValueError("Maximum 100 keywords allowed per topic")
        cleaned = []
        for kw in v:
            kw = kw.strip()
            if kw and len(kw) <= 255:
                cleaned.append(kw)
        return cleaned

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return v.strip()


class TopicKeywordResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    keywords: list[str]
    sentiment_direction: str
    category: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
