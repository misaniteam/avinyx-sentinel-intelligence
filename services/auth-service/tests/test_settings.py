"""Tests for the tenant settings router (auth-service)."""

from conftest import FakeDBResult


class _FakeTenant:
    """Minimal stand-in for the Tenant SQLAlchemy model."""

    def __init__(self, settings: dict | None = None):
        self.id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        self.settings = settings


class TestGetTenantSettings:
    """GET /auth/tenant-settings"""

    def test_returns_settings_with_masked_api_key(self, client, fake_db):
        tenant = _FakeTenant(
            settings={
                "ai": {"provider": "claude", "api_key": "sk-secret-12345"},
                "general": {"name": "My Party"},
            }
        )
        fake_db.set_execute_result(FakeDBResult(scalar=tenant))

        resp = client.get("/auth/tenant-settings")
        assert resp.status_code == 200

        body = resp.json()
        assert body["settings"]["ai"]["api_key"] == "****"
        assert body["settings"]["ai"]["provider"] == "claude"
        assert body["settings"]["general"]["name"] == "My Party"

    def test_returns_empty_settings_when_none(self, client, fake_db):
        tenant = _FakeTenant(settings=None)
        fake_db.set_execute_result(FakeDBResult(scalar=tenant))

        resp = client.get("/auth/tenant-settings")
        assert resp.status_code == 200
        assert resp.json()["settings"] == {}

    def test_returns_404_when_tenant_not_found(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(scalar=None))

        resp = client.get("/auth/tenant-settings")
        assert resp.status_code == 404


class TestPatchTenantSettings:
    """PATCH /auth/tenant-settings"""

    def test_accepts_valid_ai_settings(self, client, fake_db):
        tenant = _FakeTenant(settings={})
        fake_db.set_execute_result(FakeDBResult(scalar=tenant))

        resp = client.patch(
            "/auth/tenant-settings",
            json={"settings": {"ai": {"provider": "openai", "api_key": "sk-abc"}}},
        )
        assert resp.status_code == 200

    def test_accepts_valid_notifications_settings(self, client, fake_db):
        tenant = _FakeTenant(settings={})
        fake_db.set_execute_result(FakeDBResult(scalar=tenant))

        resp = client.patch(
            "/auth/tenant-settings",
            json={"settings": {"notifications": {"email_enabled": True}}},
        )
        assert resp.status_code == 200

    def test_accepts_valid_general_settings(self, client, fake_db):
        tenant = _FakeTenant(settings={})
        fake_db.set_execute_result(FakeDBResult(scalar=tenant))

        resp = client.patch(
            "/auth/tenant-settings",
            json={"settings": {"general": {"timezone": "UTC"}}},
        )
        assert resp.status_code == 200

    def test_rejects_unknown_keys(self, client, fake_db):
        resp = client.patch(
            "/auth/tenant-settings",
            json={"settings": {"hacker_stuff": {"bad": True}}},
        )
        assert resp.status_code == 422

    def test_response_has_masked_api_key(self, client, fake_db):
        tenant = _FakeTenant(settings={"ai": {"api_key": "sk-old"}})
        fake_db.set_execute_result(FakeDBResult(scalar=tenant))

        resp = client.patch(
            "/auth/tenant-settings",
            json={
                "settings": {"ai": {"provider": "claude", "api_key": "sk-new-secret"}}
            },
        )
        assert resp.status_code == 200
        assert resp.json()["settings"]["ai"]["api_key"] == "****"
