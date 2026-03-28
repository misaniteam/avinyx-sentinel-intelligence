import re
import time
import structlog
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException
from sentinel_shared.auth.dependencies import (
    get_current_tenant_required,
    get_current_user,
    require_permissions,
)
from sentinel_shared.firebase.client import push_notification, get_firebase_app
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from pydantic import BaseModel, Field

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_logging("notification-service")
    await start_log_shipper()
    logger.info("notification-service starting")
    yield
    logger.info("notification-service shutting down")
    await stop_log_shipper()


app = FastAPI(title="Notification Service", lifespan=lifespan)


class NotificationCreate(BaseModel):
    type: Literal["alert", "info", "warning"]
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=2000)
    metadata: dict = {}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "notification-service"}


@app.post(
    "/notifications/send",
    dependencies=[Depends(require_permissions("notifications:write"))],
)
async def send_notification(
    request: NotificationCreate,
    tenant_id: str = Depends(get_current_tenant_required),
    user: dict = Depends(get_current_user),
):
    notification = {
        "type": request.type,
        "title": request.title,
        "message": request.message,
        "metadata": request.metadata,
        "read": False,
        "created_by": user.get("sub", "system"),
        "created_at": int(time.time() * 1000),
    }
    await push_notification(tenant_id, notification)
    return {"status": "sent"}


@app.get(
    "/notifications/", dependencies=[Depends(require_permissions("dashboard:view"))]
)
async def list_notifications(
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_required),
):
    """List recent notifications from Firebase RTDB."""
    from firebase_admin import db as rtdb

    app = get_firebase_app()
    if not app:
        return {"notifications": []}

    ref = rtdb.reference(f"sentinel/notifications/{tenant_id}", app=app)
    data = ref.order_by_child("created_at").limit_to_last(50).get()

    if not data:
        return {"notifications": []}

    notifications = []
    for key, val in data.items():
        notifications.append({"id": key, **val})
    notifications.sort(key=lambda x: x.get("created_at", 0), reverse=True)

    return {"notifications": notifications}


@app.patch(
    "/notifications/notifications/{notification_id}/read",
    dependencies=[Depends(require_permissions("dashboard:view"))],
)
async def mark_notification_read(
    notification_id: str,
    tenant_id: str = Depends(get_current_tenant_required),
):
    """Mark a single notification as read."""
    if not re.match(r"^[-A-Za-z0-9_]+$", notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    from firebase_admin import db as rtdb

    app = get_firebase_app()
    if not app:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    ref = rtdb.reference(
        f"sentinel/notifications/{tenant_id}/{notification_id}", app=app
    )
    ref.update({"read": True})
    return {"status": "ok"}


@app.post(
    "/notifications/notifications/mark-all-read",
    dependencies=[Depends(require_permissions("dashboard:view"))],
)
async def mark_all_read(
    tenant_id: str = Depends(get_current_tenant_required),
):
    """Mark all notifications as read for the current tenant."""
    from firebase_admin import db as rtdb

    app = get_firebase_app()
    if not app:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    ref = rtdb.reference(f"sentinel/notifications/{tenant_id}", app=app)
    data = ref.get()
    if data:
        updates = {
            f"{key}/read": True for key, val in data.items() if not val.get("read")
        }
        if updates:
            ref.update(updates)
    return {"status": "ok"}
