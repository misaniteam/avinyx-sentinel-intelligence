import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from routers import tenants_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_logging("tenant-service")
    await start_log_shipper()
    logger.info("tenant-service starting")
    yield
    logger.info("tenant-service shutting down")
    await stop_log_shipper()


app = FastAPI(title="Tenant Service", lifespan=lifespan)
app.include_router(tenants_router, prefix="/tenants/tenants", tags=["tenants"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "tenant-service"}
