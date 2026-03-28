"""Tests for notification-service endpoints."""

from unittest.mock import patch, AsyncMock


class TestSendNotification:
    """POST /notifications/send"""

    def test_valid_notification_returns_200(self, client):
        with patch("main.push_notification", new_callable=AsyncMock):
            resp = client.post(
                "/notifications/send",
                json={
                    "type": "alert",
                    "title": "Election update",
                    "message": "New poll results available",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "sent"

    def test_rejects_invalid_type(self, client):
        resp = client.post(
            "/notifications/send",
            json={
                "type": "critical",  # not in Literal["alert", "info", "warning"]
                "title": "Test",
                "message": "Body",
            },
        )
        assert resp.status_code == 422

    def test_rejects_title_over_200_chars(self, client):
        resp = client.post(
            "/notifications/send",
            json={
                "type": "info",
                "title": "A" * 201,
                "message": "Body",
            },
        )
        assert resp.status_code == 422

    def test_accepts_info_type(self, client):
        with patch("main.push_notification", new_callable=AsyncMock):
            resp = client.post(
                "/notifications/send",
                json={
                    "type": "info",
                    "title": "FYI",
                    "message": "Something happened",
                },
            )
            assert resp.status_code == 200

    def test_accepts_warning_type(self, client):
        with patch("main.push_notification", new_callable=AsyncMock):
            resp = client.post(
                "/notifications/send",
                json={
                    "type": "warning",
                    "title": "Warning",
                    "message": "Watch out",
                },
            )
            assert resp.status_code == 200


class TestMarkNotificationRead:
    """PATCH /notifications/{notification_id}/read"""

    def test_rejects_ids_with_slash(self, client):
        resp = client.patch("/notifications/notifications/../../etc/passwd/read")
        # FastAPI might match this differently; the key is that
        # the regex check in the handler rejects path-traversal IDs.
        # Depending on routing, this could be 400 or 404.
        assert resp.status_code in (400, 404, 405)

    def test_rejects_ids_with_dots(self, client):
        with patch("main.get_firebase_app") as mock_app:
            mock_app.return_value = None
            resp = client.patch("/notifications/notifications/some..bad..id/read")
            # The handler regex only allows [-A-Za-z0-9_]
            assert resp.status_code == 400

    def test_accepts_valid_firebase_push_key(self, client):
        with patch("main.get_firebase_app") as mock_app:
            mock_app.return_value = None
            resp = client.patch("/notifications/notifications/-NxAbC123_def/read")
            # Firebase not configured returns 503, but ID validation passed
            assert resp.status_code == 503

    def test_accepts_alphanumeric_id(self, client):
        with patch("main.get_firebase_app") as mock_app:
            mock_app.return_value = None
            resp = client.patch("/notifications/notifications/abc123/read")
            assert resp.status_code == 503
