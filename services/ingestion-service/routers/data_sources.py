import ipaddress
import structlog
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sentinel_shared.database.session import get_db
from sentinel_shared.models.data_source import DataSource
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    require_permissions,
)
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.config import get_settings
from pydantic import BaseModel, Field, field_validator

logger = structlog.get_logger()

router = APIRouter()

ALLOWED_PLATFORMS = (
    "brand24",
    "youtube",
    "twitter",
    "news_rss",
    "news_api",
    "reddit",
    "file_upload",
)

SENSITIVE_KEY_PATTERNS = ("key", "secret", "token", "password")

# Per-platform required and optional config keys
PLATFORM_CONFIG_SCHEMA: dict[str, dict] = {
    "brand24": {
        "required": ["api_key", "project_id"],
        "optional": ["search_queries"],
    },
    "youtube": {
        "required": ["api_key"],
        "optional": ["channel_ids", "search_queries"],
    },
    "twitter": {
        "required": ["api_key", "api_secret", "bearer_token"],
        "optional": ["search_queries"],
    },
    "news_rss": {
        "required": ["feed_urls"],
        "optional": [],
    },
    "news_api": {
        "required": ["api_key"],
        "optional": ["keywords", "categories", "domains", "language"],
    },
    "reddit": {
        "required": ["client_id", "client_secret"],
        "optional": ["subreddits"],
    },
    "file_upload": {
        "required": [],
        "optional": [],
    },
}

MASKED_VALUE = "****"


def mask_config(config: dict) -> dict:
    """Mask sensitive values in config dict (recursive)."""
    masked = {}
    for k, v in config.items():
        if isinstance(v, dict):
            masked[k] = mask_config(v)
        elif any(pattern in k.lower() for pattern in SENSITIVE_KEY_PATTERNS):
            masked[k] = MASKED_VALUE if v else v
        else:
            masked[k] = v
    return masked


def validate_config(platform: str, config: dict, is_update: bool = False) -> dict:
    """Validate and sanitize config for a given platform."""
    schema = PLATFORM_CONFIG_SCHEMA.get(platform)
    if not schema:
        return {}

    allowed_keys = set(schema["required"] + schema["optional"])
    # Strip unknown keys
    sanitized = {k: v for k, v in config.items() if k in allowed_keys}

    if not is_update:
        # On create, require all mandatory keys
        missing = [
            k for k in schema["required"] if k not in sanitized or not sanitized[k]
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required config fields for {platform}: {', '.join(missing)}",
            )

    # Validate individual field values
    for k, v in sanitized.items():
        if isinstance(v, str) and len(v) > 10_000:
            raise HTTPException(
                status_code=422, detail=f"Config field '{k}' exceeds maximum length"
            )
        if isinstance(v, list):
            if len(v) > 500:
                raise HTTPException(
                    status_code=422, detail=f"Config field '{k}' has too many items"
                )
            for item in v:
                if not isinstance(item, str) or len(item) > 2000:
                    raise HTTPException(
                        status_code=422, detail=f"Invalid item in config field '{k}'"
                    )

    # SSRF protection for URL fields
    if "feed_urls" in sanitized:
        urls = sanitized["feed_urls"]
        if isinstance(urls, list):
            for url in urls:
                _validate_url(url)
        elif isinstance(urls, str):
            _validate_url(urls)

    return sanitized


def _validate_url(url: str) -> None:
    """Validate a URL is safe (no SSRF to internal networks)."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid URL: {url}")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=422, detail=f"URL must use http or https scheme: {url}"
        )

    if not parsed.hostname:
        raise HTTPException(status_code=422, detail=f"URL missing hostname: {url}")

    hostname = parsed.hostname.lower()

    # Block obvious internal hostnames
    blocked_hosts = (
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "169.254.169.254",
        "metadata.google.internal",
    )
    if hostname in blocked_hosts:
        raise HTTPException(
            status_code=422, detail=f"Internal URLs are not allowed: {url}"
        )

    # Block private IP ranges
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(
                status_code=422, detail=f"Internal IP addresses are not allowed: {url}"
            )
    except ValueError:
        # hostname is not an IP — that's fine, it's a domain name
        pass


def merge_config(existing: dict, incoming: dict) -> dict:
    """Merge incoming config with existing, preserving keys not in incoming."""
    merged = dict(existing)
    for k, v in incoming.items():
        if v == MASKED_VALUE:
            continue  # Skip masked values
        merged[k] = v
    return merged


class DataSourceCreate(BaseModel):
    model_config = {"extra": "forbid"}

    platform: str = Field(..., max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    config: dict = Field(default_factory=dict)
    poll_interval_minutes: int = Field(default=60, ge=1, le=1440)

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        if v not in ALLOWED_PLATFORMS:
            raise ValueError(
                f"Invalid platform. Allowed: {', '.join(ALLOWED_PLATFORMS)}"
            )
        return v


class DataSourceUpdate(BaseModel):
    model_config = {"extra": "forbid"}

    name: str | None = Field(default=None, min_length=1, max_length=255)
    config: dict | None = None
    poll_interval_minutes: int | None = Field(default=None, ge=1, le=1440)
    is_active: bool | None = None


class DataSourceResponse(BaseModel):
    id: UUID
    platform: str
    name: str
    config: dict
    poll_interval_minutes: int
    is_active: bool
    last_polled_at: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, ds: DataSource) -> "DataSourceResponse":
        return cls(
            id=ds.id,
            platform=ds.platform,
            name=ds.name,
            config=mask_config(ds.config or {}),
            poll_interval_minutes=ds.poll_interval_minutes,
            is_active=ds.is_active,
            last_polled_at=str(ds.last_polled_at) if ds.last_polled_at else None,
        )


@router.get("/", response_model=list[DataSourceResponse])
async def list_data_sources(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:read")),
):
    result = await db.execute(
        select(DataSource).where(DataSource.tenant_id == tenant_id)
    )
    sources = result.scalars().all()
    return [DataSourceResponse.from_model(ds) for ds in sources]


@router.post(
    "/", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED
)
async def create_data_source(
    request: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    # Validate and sanitize config
    validated_config = validate_config(request.platform, request.config)

    # Check for duplicate name within tenant
    existing = await db.execute(
        select(DataSource).where(
            DataSource.tenant_id == tenant_id,
            DataSource.name == request.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="A data source with this name already exists",
        )

    ds = DataSource(
        platform=request.platform,
        name=request.name,
        config=validated_config,
        poll_interval_minutes=request.poll_interval_minutes,
        tenant_id=tenant_id,
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)

    # Trigger immediate ingestion for active sources (skip file_upload — handled separately)
    if ds.is_active and ds.platform != "file_upload":
        try:
            sqs = SQSClient()
            settings = get_settings()
            await sqs.send_message(
                settings.sqs_ingestion_queue,
                {
                    "tenant_id": str(ds.tenant_id),
                    "platform": ds.platform,
                    "config": ds.config or {},
                    "since": None,
                },
            )
            # Mark as polled so scheduler doesn't double-dispatch
            ds.last_polled_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(ds)
            logger.info(
                "immediate_ingestion_dispatched",
                data_source_id=str(ds.id),
                platform=ds.platform,
            )
        except Exception as exc:
            logger.error(
                "immediate_ingestion_dispatch_failed",
                data_source_id=str(ds.id),
                error=str(exc),
            )

    return DataSourceResponse.from_model(ds)


@router.get("/{source_id}", response_model=DataSourceResponse)
async def get_data_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:read")),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id, DataSource.tenant_id == tenant_id
        )
    )
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    return DataSourceResponse.from_model(ds)


@router.patch("/{source_id}", response_model=DataSourceResponse)
async def update_data_source(
    source_id: UUID,
    request: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id, DataSource.tenant_id == tenant_id
        )
    )
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")

    updates = request.model_dump(exclude_unset=True)

    # Check for duplicate name if name is being changed
    if "name" in updates and updates["name"] != ds.name:
        existing = await db.execute(
            select(DataSource).where(
                DataSource.tenant_id == tenant_id,
                DataSource.name == updates["name"],
                DataSource.id != source_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="A data source with this name already exists",
            )

    # Explicit field assignment
    if "name" in updates:
        ds.name = updates["name"]
    if "config" in updates:
        validated_config = validate_config(
            ds.platform, updates["config"], is_update=True
        )
        ds.config = merge_config(ds.config or {}, validated_config)
    if "poll_interval_minutes" in updates:
        ds.poll_interval_minutes = updates["poll_interval_minutes"]
    if "is_active" in updates:
        ds.is_active = updates["is_active"]

    await db.commit()
    await db.refresh(ds)
    return DataSourceResponse.from_model(ds)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(require_permissions("data_sources:write")),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id, DataSource.tenant_id == tenant_id
        )
    )
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    await db.delete(ds)
    await db.commit()
