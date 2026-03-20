"""Tests for the platforms router."""

from unittest.mock import MagicMock
from tests.conftest import FakeDBResult


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestPlatformBreakdown:
    def test_returns_list_of_platform_counts(self, client, fake_db):
        fake_db.set_execute_result(
            FakeDBResult(rows=[
                FakeRow(platform="twitter", count=120),
                FakeRow(platform="facebook", count=80),
            ])
        )
        resp = client.get("/analytics/platforms/breakdown")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0] == {"platform": "twitter", "count": 120}
        assert data[1] == {"platform": "facebook", "count": 80}

    def test_returns_empty_list_when_no_data(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get("/analytics/platforms/breakdown")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_accepts_date_filters(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get(
            "/analytics/platforms/breakdown",
            params={"date_from": "2025-01-01T00:00:00", "date_to": "2025-01-31T23:59:59"},
        )
        assert resp.status_code == 200


class TestEngagementOverTime:
    def test_returns_engagement_points(self, client, fake_db):
        fake_db.set_execute_result(
            FakeDBResult(rows=[
                FakeRow(period_start="2025-01-01 00:00:00", likes=100, shares=50, comments=30),
                FakeRow(period_start="2025-01-02 00:00:00", likes=120, shares=60, comments=40),
            ])
        )
        resp = client.get("/analytics/platforms/engagement-over-time")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["likes"] == 100
        assert data[1]["shares"] == 60

    def test_accepts_period_parameter(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get("/analytics/platforms/engagement-over-time", params={"period": "weekly"})
        assert resp.status_code == 200

    def test_rejects_invalid_period(self, client, fake_db):
        resp = client.get("/analytics/platforms/engagement-over-time", params={"period": "monthly"})
        assert resp.status_code == 422

    def test_returns_empty_list_when_no_data(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get("/analytics/platforms/engagement-over-time")
        assert resp.status_code == 200
        assert resp.json() == []
