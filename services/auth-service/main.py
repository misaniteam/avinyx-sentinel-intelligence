import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sentinel_shared.config import get_settings
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from routers import auth_router, users_router, roles_router, settings_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_logging("auth-service")
    await start_log_shipper()
    logger.info("auth-service starting")
    yield
    logger.info("auth-service shutting down")
    await stop_log_shipper()

app = FastAPI(title="Auth Service", lifespan=lifespan)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/auth/users", tags=["users"])
app.include_router(roles_router, prefix="/auth/roles", tags=["roles"])
app.include_router(settings_router, prefix="/auth/tenant-settings", tags=["settings"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "auth-service"}
