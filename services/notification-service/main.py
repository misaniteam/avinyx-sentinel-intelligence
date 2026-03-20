import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sentinel_shared.database.session import get_db
from sentinel_shared.auth.dependencies import get_current_tenant, get_current_user
from sentinel_shared.firebase.client import push_notification
from pydantic import BaseModel

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("notification-service starting")
    yield
    logger.info("notification-service shutting down")

app = FastAPI(title="Notification Service", lifespan=lifespan)

class NotificationCreate(BaseModel):
    type: str  # alert, info, warning
    title: str
    message: str
    metadata: dict = {}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "notification-service"}

@app.post("/notifications/send")
async def send_notification(
    request: NotificationCreate,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    notification = {
        "type": request.type,
        "title": request.title,
        "message": request.message,
        "metadata": request.metadata,
        "read": False,
        "created_by": user.get("sub"),
    }
    await push_notification(tenant_id, notification)
    return {"status": "sent"}
