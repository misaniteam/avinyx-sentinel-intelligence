"""Tests for the reports router."""

import uuid
from unittest.mock import MagicMock, patch
from tests.conftest import FakeDBResult


class FakeReport:
    """Mimics the Report SQLAlchemy model."""

    def __init__(self, **kwargs):
        self.id = kwargs.get("id", uuid.uuid4())
        self.name = kwargs.get("name", "Test Report")
        self.config = kwargs.get("config", {})
        self.format = kwargs.get("format", "pdf")
        self.status = kwargs.get("status", "pending")
        self.generated_file = kwargs.get("generated_file", None)
        self.tenant_id = kwargs.get("tenant_id", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


class TestCreateReport:
    def _patch_db_for_create(self, fake_db):
        """Make the FakeDB simulate setting column defaults on refresh,
        as a real DB would after INSERT."""
        original_refresh = fake_db.refresh

        async def refresh_with_defaults(obj):
            if not getattr(obj, "id", None):
                obj.id = uuid.uuid4()
            if not getattr(obj, "status", None):
                obj.status = "pending"
            await original_refresh(obj)

        fake_db.refresh = refresh_with_defaults

    def test_creates_report_with_valid_format(self, client, fake_db):
        self._patch_db_for_create(fake_db)

        resp = client.post(
            "/reports/",
            json={"name": "Weekly Sentiment", "format": "pdf", "config": {}},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Weekly Sentiment"
        assert data["format"] == "pdf"
        assert data["status"] == "pending"

    def test_creates_report_with_image_format(self, client, fake_db):
        self._patch_db_for_create(fake_db)

        resp = client.post(
            "/reports/",
            json={"name": "Image Report", "format": "image"},
        )
        assert resp.status_code == 201
        assert resp.json()["format"] == "image"

    def test_creates_report_with_csv_format(self, client, fake_db):
        self._patch_db_for_create(fake_db)

        resp = client.post(
            "/reports/",
            json={"name": "CSV Export", "format": "csv"},
        )
        assert resp.status_code == 201
        assert resp.json()["format"] == "csv"

    def test_rejects_invalid_format(self, client, fake_db):
        resp = client.post(
            "/reports/",
            json={"name": "Bad Report", "format": "xlsx"},
        )
        assert resp.status_code == 422


class TestGenerateReport:
    def test_returns_generating_status(self, client, fake_db):
        report_id = uuid.uuid4()
        fake_report = FakeReport(id=report_id, status="pending")
        fake_db.set_execute_result(FakeDBResult(scalar=fake_report))

        resp = client.post(f"/reports/{report_id}/generate")
        assert resp.status_code == 200
        assert resp.json()["status"] == "generating"

    def test_returns_409_if_already_generating(self, client, fake_db):
        report_id = uuid.uuid4()
        fake_report = FakeReport(id=report_id, status="generating")
        fake_db.set_execute_result(FakeDBResult(scalar=fake_report))

        resp = client.post(f"/reports/{report_id}/generate")
        assert resp.status_code == 409
        assert "already being generated" in resp.json()["detail"]

    def test_returns_404_if_report_not_found(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(scalar=None))
        resp = client.post(f"/reports/{uuid.uuid4()}/generate")
        assert resp.status_code == 404


class TestDownloadReport:
    def test_returns_400_if_not_generated(self, client, fake_db):
        report_id = uuid.uuid4()
        fake_report = FakeReport(id=report_id, status="pending", generated_file=None)
        fake_db.set_execute_result(FakeDBResult(scalar=fake_report))

        resp = client.get(f"/reports/{report_id}/download")
        assert resp.status_code == 400
        assert "not been generated" in resp.json()["detail"]

    def test_returns_404_if_report_not_found(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(scalar=None))
        resp = client.get(f"/reports/{uuid.uuid4()}/download")
        assert resp.status_code == 404

    @patch("routers.reports._get_s3_client")
    def test_returns_download_url_when_generated(self, mock_s3_factory, client, fake_db):
        report_id = uuid.uuid4()
        fake_report = FakeReport(
            id=report_id,
            status="completed",
            generated_file=f"tenant-1/{report_id}.pdf",
        )
        fake_db.set_execute_result(FakeDBResult(scalar=fake_report))

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/report.pdf"
        mock_s3_factory.return_value = mock_s3

        resp = client.get(f"/reports/{report_id}/download")
        assert resp.status_code == 200
        data = resp.json()
        assert data["download_url"] == "https://s3.example.com/report.pdf"
        assert data["expires_in"] == 600
