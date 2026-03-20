"""Tests for the topics router."""

from tests.conftest import FakeDBResult


class FakeRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestTopTopics:
    def test_returns_list_of_topic_counts(self, client, fake_db):
        fake_db.set_execute_result(
            FakeDBResult(rows=[
                FakeRow(topic="economy", count=42),
                FakeRow(topic="healthcare", count=35),
            ])
        )
        resp = client.get("/topics/top")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0] == {"topic": "economy", "count": 42}
        assert data[1] == {"topic": "healthcare", "count": 35}

    def test_returns_empty_list_when_no_data(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get("/topics/top")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_limit_parameter_accepted(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get("/topics/top", params={"limit": 5})
        assert resp.status_code == 200

    def test_limit_validation_min(self, client, fake_db):
        resp = client.get("/topics/top", params={"limit": 0})
        assert resp.status_code == 422

    def test_limit_validation_max(self, client, fake_db):
        resp = client.get("/topics/top", params={"limit": 200})
        assert resp.status_code == 422

    def test_accepts_date_filters(self, client, fake_db):
        fake_db.set_execute_result(FakeDBResult(rows=[]))
        resp = client.get(
            "/topics/top",
            params={"date_from": "2025-06-01T00:00:00", "date_to": "2025-06-30T23:59:59"},
        )
        assert resp.status_code == 200
