import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from routers import (
    campaigns_router,
    voters_router,
    media_feeds_router,
    topic_keywords_router,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_logging("campaign-service")
    await start_log_shipper()
    logger.info("campaign-service starting")
    yield
    logger.info("campaign-service shutting down")
    await stop_log_shipper()


app = FastAPI(title="Campaign Service", lifespan=lifespan)
app.include_router(campaigns_router, prefix="/campaigns/campaigns", tags=["campaigns"])
app.include_router(voters_router, prefix="/campaigns/voters", tags=["voters"])
app.include_router(
    media_feeds_router, prefix="/campaigns/media-feeds", tags=["media-feeds"]
)
app.include_router(
    topic_keywords_router, prefix="/campaigns/topic-keywords", tags=["topic-keywords"]
)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "campaign-service"}
