import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sentinel_shared.config import get_settings
from routers import auth_router, users_router, roles_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("auth-service starting")
    yield
    logger.info("auth-service shutting down")

app = FastAPI(title="Auth Service", lifespan=lifespan)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(roles_router, prefix="/roles", tags=["roles"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "auth-service"}
