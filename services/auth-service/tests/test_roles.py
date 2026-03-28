"""Tests for the roles router (auth-service)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

from conftest import FakeDBResult, FAKE_TENANT_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _FakeRole:
    """Minimal stand-in for the Role SQLAlchemy model."""

    def __init__(
        self,
        name: str = "Analyst",
        description: str | None = "Read-only access",
        permissions: list[str] | None = None,
        tenant_id: str = FAKE_TENANT_ID,
    ):
        self.id = uuid.uuid4()
        self.name = name
        self.description = description
        self.permissions = permissions or ["dashboard:view", "analytics:read"]
        self.tenant_id = tenant_id
        self.created_at = datetime.now(timezone.utc)


class _SequentialFakeDB:
    """A FakeDB variant that returns different results for successive execute() calls.

    This is needed for endpoints that issue multiple queries (e.g. a uniqueness
    check followed by the main query).
    """

    def __init__(self, results: list[FakeDBResult]):
        self._results = list(results)
        self._call_idx = 0
        self._added: list = []

    async def execute(self, stmt):
        result = self._results[min(self._call_idx, len(self._results) - 1)]
        self._call_idx += 1
        return result

    def add(self, obj):
        self._added.append(obj)

    async def commit(self):
        pass

    async def refresh(self, obj):
        # Populate missing fields that the router expects after refresh
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid.uuid4()
        if not hasattr(obj, "created_at") or obj.created_at is None:
            obj.created_at = datetime.now(timezone.utc)

    def set_execute_result(self, result: FakeDBResult):
        self._results = [result]
        self._call_idx = 0


# ---------------------------------------------------------------------------
# Permission Validation (CRITICAL security tests)
# ---------------------------------------------------------------------------


class TestPermissionValidation:
    """Pydantic schema rejects dangerous / invalid permissions at the API layer."""

    def test_create_with_valid_permissions_succeeds(self, client, fake_db):
        """Creating a role with known-good permissions should succeed."""
        # First execute = uniqueness check (count=0), second = after commit
        seq_db = _SequentialFakeDB(
            [
                FakeDBResult(scalar=0),  # _check_name_unique count
            ]
        )
        # Override get_db to return our sequential db
        from main import app
        from sentinel_shared.database.session import get_db

        app.dependency_overrides[get_db] = lambda: seq_db

        resp = client.post(
            "/auth/roles/",
            json={
                "name": "Campaign Viewer",
                "description": "Can view campaigns",
                "permissions": ["campaigns:read", "dashboard:view"],
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Campaign Viewer"
        assert set(body["permissions"]) == {"campaigns:read", "dashboard:view"}

    def test_create_with_wildcard_permission_rejected(self, client):
        """The '*' wildcard must NEVER be assignable to a custom role."""
        resp = client.post(
            "/auth/roles/",
            json={
                "name": "Hacker Role",
                "permissions": ["*"],
            },
        )
        assert resp.status_code == 422

    def test_create_with_unknown_permission_rejected(self, client):
        """Unknown permission strings should be rejected."""
        resp = client.post(
            "/auth/roles/",
            json={
                "name": "Bad Perms",
                "permissions": ["nuclear:launch", "dashboard:view"],
            },
        )
        assert resp.status_code == 422

    def test_create_with_over_50_permissions_rejected(self, client):
        """More than 50 permissions should be rejected."""
        perms = ["dashboard:view"] * 51
        resp = client.post(
            "/auth/roles/",
            json={
                "name": "Too Many Perms",
                "permissions": perms,
            },
        )
        assert resp.status_code == 422

    def test_update_with_invalid_permissions_rejected(self, client, fake_db):
        """PATCH with invalid permissions should also be rejected."""
        role = _FakeRole()
        fake_db.set_execute_result(FakeDBResult(scalar=role))

        resp = client.patch(
            f"/auth/roles/{role.id}",
            json={
                "permissions": ["*"],
            },
        )
        assert resp.status_code == 422

    def test_update_with_unknown_permissions_rejected(self, client, fake_db):
        """PATCH with unknown permission strings should be rejected."""
        role = _FakeRole()
        fake_db.set_execute_result(FakeDBResult(scalar=role))

        resp = client.patch(
            f"/auth/roles/{role.id}",
            json={
                "permissions": ["system:destroy"],
            },
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Name Validation
# ---------------------------------------------------------------------------


class TestNameValidation:
    """Role name constraints enforced by Pydantic schema."""

    def test_create_with_empty_name_rejected(self, client):
        resp = client.post(
            "/auth/roles/",
            json={
                "name": "",
                "permissions": [],
            },
        )
        assert resp.status_code == 422

    def test_create_with_name_over_100_chars_rejected(self, client):
        resp = client.post(
            "/auth/roles/",
            json={
                "name": "A" * 101,
                "permissions": [],
            },
        )
        assert resp.status_code == 422

    def test_duplicate_name_returns_409(self, client):
        """Duplicate role name within same tenant returns 409."""
        from main import app
        from sentinel_shared.database.session import get_db

        seq_db = _SequentialFakeDB(
            [
                FakeDBResult(scalar=1),  # _check_name_unique finds existing
            ]
        )
        app.dependency_overrides[get_db] = lambda: seq_db

        resp = client.post(
            "/auth/roles/",
            json={
                "name": "Existing Role",
                "permissions": ["dashboard:view"],
            },
        )
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Tenant Isolation
# ---------------------------------------------------------------------------


class TestTenantIsolation:
    """Endpoints that use get_current_tenant_required reject missing tenant context."""

    def test_super_admin_without_tenant_gets_400(self):
        """Super admin with tenant_id=None should receive 400."""
        from main import app
        from sentinel_shared.database.session import get_db
        from sentinel_shared.auth.dependencies import (
            get_current_user,
            get_current_tenant_required,
        )
        from fastapi.testclient import TestClient

        # Override get_current_user to return super admin without tenant
        app.dependency_overrides[get_current_user] = lambda: {
            "sub": "super-1",
            "tenant_id": None,
            "is_super_admin": True,
            "permissions": ["*"],
        }
        # Remove the tenant override so the real dependency chain runs
        app.dependency_overrides.pop(get_current_tenant_required, None)
        app.dependency_overrides[get_db] = lambda: MagicMock()

        try:
            c = TestClient(app)
            resp = c.get("/auth/roles/")
            assert resp.status_code == 400
            assert "Tenant context required" in resp.json()["detail"]
        finally:
            app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# CRUD Operations
# ---------------------------------------------------------------------------


class TestListRoles:
    """GET /auth/roles/"""

    def test_returns_tenant_roles(self, client, fake_db):
        role1 = _FakeRole(name="Viewer")
        role2 = _FakeRole(name="Editor")
        fake_db.set_execute_result(FakeDBResult(rows=[role1, role2]))

        resp = client.get("/auth/roles/")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        assert body[0]["name"] == "Viewer"
        assert body[1]["name"] == "Editor"

    def test_returns_empty_list_when_no_roles(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))

        resp = client.get("/auth/roles/")
        assert resp.status_code == 200
        assert resp.json() == []


class TestCreateRole:
    """POST /auth/roles/"""

    def test_returns_201(self, client):
        from main import app
        from sentinel_shared.database.session import get_db

        seq_db = _SequentialFakeDB(
            [
                FakeDBResult(scalar=0),  # uniqueness check passes
            ]
        )
        app.dependency_overrides[get_db] = lambda: seq_db

        resp = client.post(
            "/auth/roles/",
            json={
                "name": "New Role",
                "description": "A fresh role",
                "permissions": ["dashboard:view"],
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "New Role"
        assert body["description"] == "A fresh role"
        assert "id" in body
        assert "created_at" in body


class TestGetRole:
    """GET /auth/roles/{role_id}"""

    def test_get_existing_role(self, client, fake_db):
        role = _FakeRole(name="Target Role")
        fake_db.set_execute_result(FakeDBResult(scalar=role))

        resp = client.get(f"/auth/roles/{role.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Target Role"

    def test_get_nonexistent_role_returns_404(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(scalar=None))

        resp = client.get(f"/auth/roles/{uuid.uuid4()}")
        assert resp.status_code == 404


class TestUpdateRole:
    """PATCH /auth/roles/{role_id}"""

    def test_partial_update_name(self, client):
        from main import app
        from sentinel_shared.database.session import get_db

        role = _FakeRole(name="Old Name")
        seq_db = _SequentialFakeDB(
            [
                FakeDBResult(scalar=role),  # _get_role_or_404
                FakeDBResult(scalar=0),  # _check_name_unique
            ]
        )
        app.dependency_overrides[get_db] = lambda: seq_db

        resp = client.patch(f"/auth/roles/{role.id}", json={"name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    def test_partial_update_permissions(self, client, fake_db):
        role = _FakeRole(name="Analyst", permissions=["dashboard:view"])
        fake_db.set_execute_result(FakeDBResult(scalar=role))

        resp = client.patch(
            f"/auth/roles/{role.id}",
            json={
                "permissions": ["dashboard:view", "analytics:read"],
            },
        )
        assert resp.status_code == 200
        assert set(resp.json()["permissions"]) == {"dashboard:view", "analytics:read"}

    def test_update_nonexistent_role_returns_404(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(scalar=None))

        resp = client.patch(f"/auth/roles/{uuid.uuid4()}", json={"name": "Ghost"})
        assert resp.status_code == 404


class TestDeleteRole:
    """DELETE /auth/roles/{role_id}"""

    def test_delete_existing_role_returns_204(self, client, fake_db):
        role = _FakeRole()
        fake_db.set_execute_result(FakeDBResult(scalar=role))

        resp = client.delete(f"/auth/roles/{role.id}")
        assert resp.status_code == 204

    def test_delete_nonexistent_role_returns_404(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(scalar=None))

        resp = client.delete(f"/auth/roles/{uuid.uuid4()}")
        assert resp.status_code == 404
