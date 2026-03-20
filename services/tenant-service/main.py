import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from routers import tenants_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("tenant-service starting")
    yield
    logger.info("tenant-service shutting down")

app = FastAPI(title="Tenant Service", lifespan=lifespan)
app.include_router(tenants_router, prefix="/tenants/tenants", tags=["tenants"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "tenant-service"}
