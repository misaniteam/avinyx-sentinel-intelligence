import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from routers import dashboard_router, heatmap_router, reports_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("analytics-service starting")
    yield
    logger.info("analytics-service shutting down")

app = FastAPI(title="Analytics Service", lifespan=lifespan)
app.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
app.include_router(heatmap_router, prefix="/heatmap", tags=["heatmap"])
app.include_router(reports_router, prefix="/reports", tags=["reports"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "analytics-service"}
