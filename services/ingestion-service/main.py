import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from routers import data_sources_router, ingested_data_router
from scheduler import check_and_dispatch_polls

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ingestion-service starting")

    # Start APScheduler for polling data sources
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        check_and_dispatch_polls,
        "interval",
        seconds=60,
        id="poll_checker",
        name="Check and dispatch data source polls",
    )
    scheduler.start()
    logger.info("scheduler_started", job_interval_seconds=60)

    yield

    scheduler.shutdown()
    logger.info("ingestion-service shutting down")

app = FastAPI(title="Ingestion Service", lifespan=lifespan)
app.include_router(data_sources_router, prefix="/ingestion/data-sources", tags=["data-sources"])
app.include_router(ingested_data_router, prefix="/ingestion/ingested-data", tags=["ingested-data"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ingestion-service"}
