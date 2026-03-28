"""Shared fixtures for analytics-service tests.

Provides a FastAPI TestClient with dependency overrides so that
database, auth, and tenant dependencies are mocked out.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure the service root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ---------------------------------------------------------------------------
# Now safe to import the app and dependencies
# ---------------------------------------------------------------------------
from main import app  # noqa: E402
from sentinel_shared.database.session import get_db  # noqa: E402
from sentinel_shared.auth.dependencies import (  # noqa: E402
    get_current_tenant_required,
)

FAKE_TENANT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

FAKE_USER = {
    "sub": "user-1",
    "tenant_id": FAKE_TENANT_ID,
    "is_super_admin": False,
    "permissions": ["*"],
}


class FakeDBResult:
    """Mimics the result object returned by db.execute()."""

    def __init__(self, rows=None, scalar=None):
        self._rows = rows or []
        self._scalar = scalar

    def all(self):
        return self._rows

    def scalars(self):
        return self

    def scalar_one_or_none(self):
        return self._scalar


class FakeDB:
    """Async mock for SQLAlchemy AsyncSession."""

    def __init__(self):
        self._execute_result = FakeDBResult()
        self._added = []

    async def execute(self, stmt):
        return self._execute_result

    def add(self, obj):
        self._added.append(obj)

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass

    def set_execute_result(self, result: FakeDBResult):
        self._execute_result = result


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def client(fake_db):
    """TestClient with all auth/db dependencies overridden."""

    app.dependency_overrides[get_db] = lambda: fake_db
    app.dependency_overrides[get_current_tenant_required] = lambda: FAKE_TENANT_ID

    # We can't easily override the dynamic require_permissions, so instead
    # we override get_current_user which is the underlying dependency.
    from sentinel_shared.auth.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: FAKE_USER

    yield TestClient(app)

    app.dependency_overrides.clear()
