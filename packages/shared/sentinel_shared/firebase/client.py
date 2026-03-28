import firebase_admin
from firebase_admin import credentials, db
from sentinel_shared.config import get_settings

_app = None


def get_firebase_app():
    global _app
    if _app is None:
        settings = get_settings()
        if settings.firebase_credentials_path:
            cred = credentials.Certificate(settings.firebase_credentials_path)
            _app = firebase_admin.initialize_app(
                cred,
                {
                    "databaseURL": f"https://{settings.firebase_project_id}-default-rtdb.firebaseio.com"
                },
            )
        else:
            # For testing/development without Firebase
            return None
    return _app


async def update_worker_status(tenant_id: str, worker_run_id: str, status: dict):
    app = get_firebase_app()
    if app is None:
        return
    ref = db.reference(f"/sentinel/workers/{tenant_id}/{worker_run_id}")
    ref.update(status)


async def push_notification(tenant_id: str, notification: dict):
    app = get_firebase_app()
    if app is None:
        return
    ref = db.reference(f"/sentinel/notifications/{tenant_id}")
    ref.push(notification)
