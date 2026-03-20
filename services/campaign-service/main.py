import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from routers import campaigns_router, voters_router, media_feeds_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("campaign-service starting")
    yield
    logger.info("campaign-service shutting down")

app = FastAPI(title="Campaign Service", lifespan=lifespan)
app.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
app.include_router(voters_router, prefix="/voters", tags=["voters"])
app.include_router(media_feeds_router, prefix="/media-feeds", tags=["media-feeds"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "campaign-service"}
