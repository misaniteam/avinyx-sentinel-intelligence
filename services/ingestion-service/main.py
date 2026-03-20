import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from routers import data_sources_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ingestion-service starting")
    # TODO: Start APScheduler for polling data sources
    yield
    logger.info("ingestion-service shutting down")

app = FastAPI(title="Ingestion Service", lifespan=lifespan)
app.include_router(data_sources_router, prefix="/data-sources", tags=["data-sources"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ingestion-service"}
