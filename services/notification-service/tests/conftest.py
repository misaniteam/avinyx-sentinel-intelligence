"""Shared fixtures for notification-service tests.

Provides a FastAPI TestClient with dependency overrides so that
database, auth, Firebase, and tenant dependencies are mocked out.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure the service root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ---------------------------------------------------------------------------
# Now safe to import the app and dependencies
# ---------------------------------------------------------------------------
from sentinel_shared.database.session import get_db  # noqa: E402
from sentinel_shared.auth.dependencies import (  # noqa: E402
    get_current_tenant_required,
    get_current_user,
)

FAKE_TENANT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

FAKE_USER = {
    "sub": "user-1",
    "tenant_id": FAKE_TENANT_ID,
    "is_super_admin": False,
    "permissions": ["*"],
}


class FakeDB:
    """Async mock for SQLAlchemy AsyncSession."""

    async def execute(self, stmt):
        return MagicMock()

    async def commit(self):
        pass


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def client(fake_db):
    """TestClient with all auth/db/firebase dependencies overridden."""
    # Patch push_notification before importing app so it doesn't need Firebase
    with patch(
        "sentinel_shared.firebase.client.push_notification", new_callable=AsyncMock
    ):
        from main import app

        app.dependency_overrides[get_db] = lambda: fake_db
        app.dependency_overrides[get_current_tenant_required] = lambda: FAKE_TENANT_ID
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        yield TestClient(app)

        app.dependency_overrides.clear()
