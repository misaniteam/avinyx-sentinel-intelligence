import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from routers import dashboard_router, heatmap_router, reports_router, platforms_router, topics_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("analytics-service starting")
    yield
    logger.info("analytics-service shutting down")

app = FastAPI(title="Analytics Service", lifespan=lifespan)
app.include_router(dashboard_router, prefix="/analytics/dashboard", tags=["dashboard"])
app.include_router(heatmap_router, prefix="/analytics/heatmap", tags=["heatmap"])
app.include_router(reports_router, prefix="/analytics/reports", tags=["reports"])
app.include_router(platforms_router, prefix="/analytics/platforms", tags=["platforms"])
app.include_router(topics_router, prefix="/analytics/topics", tags=["topics"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "analytics-service"}
