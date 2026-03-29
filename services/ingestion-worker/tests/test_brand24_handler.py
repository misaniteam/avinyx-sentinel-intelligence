"""Tests for the Brand24Handler (Brand24 API Data — aggregated analytics)."""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FAKE_TENANT_ID = str(uuid.uuid4())
FAKE_PROJECT_ID = "123456789"
FAKE_API_KEY = "test-api-key-abc123"
BASE_URL = "https://api-data.brand24.com/api-data/v1"

# ---------------------------------------------------------------------------
# Mock API response builders
# ---------------------------------------------------------------------------


def _daily_metrics_response(dates: list[str]) -> dict:
    """Build a successful daily-metrics API response."""
    days = []
    for d in dates:
        days.append(
            {
                "date": d,
                "mentions_count": 320,
                "reach_total": 540000,
                "sentiment": {"positive": 0.35, "neutral": 0.45, "negative": 0.20},
                "engagement": {"likes": 2100, "comments": 340, "shares": 95},
                "by_source": [
                    {"source": "twitter", "mentions_count": 180, "reach": 380000},
                    {"source": "news", "mentions_count": 40, "reach": 120000},
                ],
            }
        )
    return {"status": "success", "data": {"project_id": int(FAKE_PROJECT_ID), "from": dates[0], "to": dates[-1], "days": days}}


def _sentiment_response(dates: list[str]) -> dict:
    """Build a successful mentions/sentiment API response."""
    mentions = {d: 320 for d in dates}
    positive = {d: 112 for d in dates}
    negative = {d: 64 for d in dates}
    return {
        "status": "success",
        "data": {
            "mentions": mentions,
            "total_mentions": 320 * len(dates),
            "positive_mentions": positive,
            "total_positive_mentions": 112 * len(dates),
            "negative_mentions": negative,
            "total_negative_results": 64 * len(dates),
        },
    }


def _reach_response(dates: list[str]) -> dict:
    """Build a successful mentions/reach API response."""
    social = {d: 380000 for d in dates}
    non_social = {d: 160000 for d in dates}
    return {
        "status": "success",
        "data": {
            "social_media_reach": social,
            "social_media_reach_total": 380000 * len(dates),
            "non_social_media_reach": non_social,
            "non_social_media_reach_total": 160000 * len(dates),
        },
    }


def _topics_response() -> dict:
    """Build a successful topics API response."""
    return {
        "status": "success",
        "data": {
            "project_id": int(FAKE_PROJECT_ID),
            "status": "ok",
            "topics": [
                {
                    "topic_id": 1,
                    "topic_name": "Product Launch",
                    "description": "Discussions about new product releases",
                    "mentions": 542,
                    "reach": 1250000.5,
                    "sentiment": {"positive": 45.2, "negative": 12.8, "neutral": 42.0},
                    "share_of_voice": 35.67,
                },
                {
                    "topic_id": 2,
                    "topic_name": "Customer Support",
                    "description": "Mentions related to customer service",
                    "mentions": 318,
                    "reach": 870000.0,
                    "sentiment": {"positive": 28.5, "negative": 38.1, "neutral": 33.4},
                    "share_of_voice": 22.15,
                },
            ],
        },
    }


def _events_response(dates: list[str]) -> dict:
    """Build a successful project_events API response."""
    anomalies = []
    if dates:
        anomalies.append(
            {
                "anomaly_date": dates[0],
                "project_id": int(FAKE_PROJECT_ID),
                "description": "Spike in mentions related to product launch.",
                "peak_mentions": 1540,
                "peak_reach": 9800000,
            }
        )
    return {
        "status": "success",
        "data": {
            "project_id": str(FAKE_PROJECT_ID),
            "project_name": "Test Brand",
            "anomalies": anomalies,
            "total": len(anomalies),
        },
    }


def _domains_response() -> dict:
    """Build a successful domains API response."""
    return {
        "status": "success",
        "data": {
            "project_id": int(FAKE_PROJECT_ID),
            "date_from": "2024-01-01",
            "date_to": "2024-01-07",
            "domains": [
                {"domain": "x.com", "mentions_count": 51, "reach": 77000, "visits": 76000000, "influence_score": 10},
                {"domain": "reddit.com", "mentions_count": 18, "reach": 270000, "visits": 4600000000, "influence_score": 10},
            ],
            "total_domains": 2,
        },
    }


def _trending_links_response() -> dict:
    """Build a successful trending-links API response."""
    return {
        "status": "success",
        "data": {
            "project_id": int(FAKE_PROJECT_ID),
            "date_from": "2024-01-01",
            "date_to": "2024-01-07",
            "trending_links": [
                {"url": "https://example.com/article/trending", "mentions_count": 45},
                {"url": "https://blog.example.com/post/12345", "mentions_count": 32},
            ],
            "total_links": 2,
        },
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_tenant():
    with patch("handlers.brand24.tenant_context") as mock_ctx:
        mock_ctx.get.return_value = FAKE_TENANT_ID
        yield mock_ctx


@pytest.fixture
def handler():
    from handlers.brand24 import Brand24Handler

    return Brand24Handler()


@pytest.fixture
def valid_config():
    return {"api_key": FAKE_API_KEY, "project_id": FAKE_PROJECT_ID}


def _make_mock_response(json_data: dict, status_code: int = 200) -> httpx.Response:
    """Create a mock httpx.Response with the given JSON data."""
    response = httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("GET", "https://example.com"),
    )
    return response


# ---------------------------------------------------------------------------
# Tests — config validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_missing_api_key_returns_empty(handler, mock_tenant):
    """Handler should return empty list when api_key is missing."""
    results = await handler.fetch({"project_id": FAKE_PROJECT_ID}, since=None)
    assert results == []


@pytest.mark.asyncio
async def test_missing_project_id_returns_empty(handler, mock_tenant):
    """Handler should return empty list when project_id is missing."""
    results = await handler.fetch({"api_key": FAKE_API_KEY}, since=None)
    assert results == []


@pytest.mark.asyncio
async def test_empty_config_returns_empty(handler, mock_tenant):
    """Handler should return empty list with empty config."""
    results = await handler.fetch({}, since=None)
    assert results == []


# ---------------------------------------------------------------------------
# Tests — successful fetch
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_creates_one_item_per_day(handler, mock_tenant, valid_config):
    """Handler should create one RawMediaItem per day from daily metrics."""
    dates = ["2024-01-01", "2024-01-02", "2024-01-03"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            return _make_mock_response(_sentiment_response(dates))
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            return _make_mock_response(_events_response(dates))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert len(results) == 3
    for i, item in enumerate(results):
        assert item.platform == "brand24"
        assert item.tenant_id == FAKE_TENANT_ID
        assert item.author == "Brand24"
        assert item.external_id == f"{FAKE_PROJECT_ID}_{dates[i]}"
        assert item.engagement["likes"] == 2100
        assert item.engagement["comments"] == 340
        assert item.engagement["shares"] == 95


@pytest.mark.asyncio
async def test_item_content_contains_summary(handler, mock_tenant, valid_config):
    """The content field should contain a human-readable summary."""
    dates = ["2024-01-01"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            return _make_mock_response(_sentiment_response(dates))
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            return _make_mock_response(_events_response(dates))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert len(results) == 1
    content = results[0].content
    assert "Brand24 Daily Summary for 2024-01-01" in content
    assert "Mentions: 320" in content
    assert "Sentiment: +112 / -64" in content
    assert "social:" in content
    assert "non-social:" in content
    assert "Engagement:" in content
    assert "2,100 likes" in content
    assert "Sources:" in content
    assert "twitter(180)" in content


@pytest.mark.asyncio
async def test_raw_payload_structure(handler, mock_tenant, valid_config):
    """The raw_payload should contain all expected keys."""
    dates = ["2024-01-05"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            return _make_mock_response(_sentiment_response(dates))
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            return _make_mock_response(_events_response([]))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-05T00:00:00Z")

    assert len(results) == 1
    payload = results[0].raw_payload

    assert payload["date"] == "2024-01-05"
    assert payload["project_id"] == FAKE_PROJECT_ID
    assert payload["mentions_count"] == 320
    assert payload["reach_total"] == 540000
    assert payload["reach_breakdown"]["social"] == 380000
    assert payload["reach_breakdown"]["non_social"] == 160000
    assert payload["sentiment"]["positive"] == 0.35
    assert payload["sentiment_counts"]["positive"] == 112
    assert payload["sentiment_counts"]["negative"] == 64
    assert payload["sentiment_counts"]["neutral"] == 320 - 112 - 64
    assert payload["sentiment_score"] == round(0.35 - 0.20, 4)
    assert payload["engagement"]["likes"] == 2100
    assert len(payload["by_source"]) == 2
    assert payload["events"] == []


# ---------------------------------------------------------------------------
# Tests — range-level data placement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_range_data_only_on_most_recent_day(handler, mock_tenant, valid_config):
    """Topics, domains, and trending_links should only appear on the most recent day."""
    dates = ["2024-01-01", "2024-01-02", "2024-01-03"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            return _make_mock_response(_sentiment_response(dates))
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            return _make_mock_response(_events_response([]))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert len(results) == 3

    # First two days: no range data
    for item in results[:2]:
        payload = item.raw_payload
        assert payload["has_range_data"] is False
        assert payload["topics"] == []
        assert payload["domains"] == []
        assert payload["trending_links"] == []

    # Last day (most recent): has range data
    last = results[2]
    payload = last.raw_payload
    assert payload["has_range_data"] is True
    assert len(payload["topics"]) == 2
    assert payload["topics"][0]["topic_name"] == "Product Launch"
    assert len(payload["domains"]) == 2
    assert payload["domains"][0]["domain"] == "x.com"
    assert len(payload["trending_links"]) == 2

    # Content should include topics and domains on the last day
    assert "Top Topics:" in last.content
    assert "Product Launch" in last.content
    assert "Top Domains:" in last.content
    assert "x.com" in last.content

    # Content should NOT include topics on earlier days
    assert "Top Topics:" not in results[0].content


# ---------------------------------------------------------------------------
# Tests — events enrichment
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_events_attached_to_correct_day(handler, mock_tenant, valid_config):
    """Anomaly events should appear on the matching day's item."""
    dates = ["2024-01-01", "2024-01-02"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            return _make_mock_response(_sentiment_response(dates))
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            # Event only on the first date
            return _make_mock_response(_events_response(["2024-01-01"]))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    # First day should have the event
    assert len(results[0].raw_payload["events"]) == 1
    assert "Spike in mentions" in results[0].raw_payload["events"][0]["description"]
    assert "Event:" in results[0].content

    # Second day should have no events
    assert len(results[1].raw_payload["events"]) == 0
    assert "Event:" not in results[1].content


# ---------------------------------------------------------------------------
# Tests — date range handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_date_range_defaults_to_7_days(handler, mock_tenant, valid_config):
    """Without `since`, the handler should default to a 7-day window."""
    call_params = {}

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            call_params["daily_metrics"] = kwargs.get("params", {})
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await handler.fetch(valid_config, since=None)

    params = call_params.get("daily_metrics", {})
    date_from = datetime.fromisoformat(params["from"])
    date_to = datetime.fromisoformat(params["to"])
    assert (date_to - date_from).days == 7


@pytest.mark.asyncio
async def test_date_range_clamped_to_31_days(handler, mock_tenant, valid_config):
    """Date ranges exceeding 31 days should be clamped."""
    call_params = {}

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            call_params["daily_metrics"] = kwargs.get("params", {})
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # 90 days ago — should be clamped to 31
        since = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        await handler.fetch(valid_config, since=since)

    params = call_params.get("daily_metrics", {})
    date_from = datetime.fromisoformat(params["from"])
    date_to = datetime.fromisoformat(params["to"])
    assert (date_to - date_from).days == 31


@pytest.mark.asyncio
async def test_invalid_since_falls_back_to_7_days(handler, mock_tenant, valid_config):
    """An invalid `since` value should fall back to 7-day default."""
    call_params = {}

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            call_params["daily_metrics"] = kwargs.get("params", {})
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await handler.fetch(valid_config, since="not-a-date")

    params = call_params.get("daily_metrics", {})
    date_from = datetime.fromisoformat(params["from"])
    date_to = datetime.fromisoformat(params["to"])
    assert (date_to - date_from).days == 7


# ---------------------------------------------------------------------------
# Tests — API error handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_daily_metrics_failure_returns_empty(handler, mock_tenant, valid_config):
    """If daily-metrics fails, handler should return empty (no days to iterate)."""

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            raise httpx.RequestError("Connection refused")
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert results == []


@pytest.mark.asyncio
async def test_sentiment_failure_still_returns_items(handler, mock_tenant, valid_config):
    """If sentiment endpoint fails, items should still be created with zero sentiment counts."""
    dates = ["2024-01-01"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            raise httpx.RequestError("Timeout")
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            return _make_mock_response(_events_response([]))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert len(results) == 1
    # Sentiment counts should be 0 since endpoint failed
    payload = results[0].raw_payload
    assert payload["sentiment_counts"]["positive"] == 0
    assert payload["sentiment_counts"]["negative"] == 0


@pytest.mark.asyncio
async def test_http_401_error_returns_empty(handler, mock_tenant, valid_config):
    """A 401 Unauthorized from daily-metrics should return empty results."""

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            response = httpx.Response(
                status_code=401,
                json={"status": "fail", "message": "Unauthorized", "code": 401},
                request=httpx.Request("GET", url),
            )
            raise httpx.HTTPStatusError("Unauthorized", request=response.request, response=response)
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert results == []


# ---------------------------------------------------------------------------
# Tests — API request verification
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_uses_x_api_key_header(handler, mock_tenant, valid_config):
    """All API calls should use X-Api-Key header, not Bearer token."""
    captured_headers = []

    async def mock_get(url, **kwargs):
        captured_headers.append(kwargs.get("headers", {}))
        if "daily-metrics" in url:
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    # All 7 API calls should use X-Api-Key
    assert len(captured_headers) == 7
    for h in captured_headers:
        assert h.get("X-Api-Key") == FAKE_API_KEY
        assert "Authorization" not in h


@pytest.mark.asyncio
async def test_correct_endpoint_urls(handler, mock_tenant, valid_config):
    """Verify all 7 endpoint URLs are called correctly."""
    captured_urls = []

    async def mock_get(url, **kwargs):
        captured_urls.append(url)
        if "daily-metrics" in url:
            return _make_mock_response({"status": "success", "data": {"days": []}})
        elif "topics" in url:
            return _make_mock_response({"status": "success", "data": {"status": "ok", "topics": []}})
        elif "project_events" in url:
            return _make_mock_response({"status": "success", "data": {"anomalies": []}})
        elif "domains" in url:
            return _make_mock_response({"status": "success", "data": {"domains": []}})
        elif "trending-links" in url:
            return _make_mock_response({"status": "success", "data": {"trending_links": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    url_set = set(captured_urls)
    expected_fragments = [
        f"/project/{FAKE_PROJECT_ID}/daily-metrics",
        f"/project/{FAKE_PROJECT_ID}/mentions/sentiment",
        f"/project/{FAKE_PROJECT_ID}/mentions/reach",
        f"/project/{FAKE_PROJECT_ID}/topics",
        f"/project/{FAKE_PROJECT_ID}/project_events",
        f"/project/{FAKE_PROJECT_ID}/domains/",
        f"/project/{FAKE_PROJECT_ID}/trending-links",
    ]
    for fragment in expected_fragments:
        assert any(fragment in u for u in url_set), f"Missing endpoint: {fragment}"


@pytest.mark.asyncio
async def test_daily_metrics_uses_from_to_params(handler, mock_tenant, valid_config):
    """daily-metrics should use 'from' and 'to' param names (not date_from/date_to)."""
    captured_params = {}

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            captured_params["daily_metrics"] = kwargs.get("params", {})
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    params = captured_params["daily_metrics"]
    assert "from" in params
    assert "to" in params
    assert "includeBySource" in params
    assert params["includeBySource"] == "true"
    # Should NOT use date_from/date_to for this endpoint
    assert "date_from" not in params
    assert "date_to" not in params


@pytest.mark.asyncio
async def test_sentiment_uses_date_from_date_to_params(handler, mock_tenant, valid_config):
    """Sentiment endpoint should use 'date_from' and 'date_to' param names."""
    captured_params = {}

    async def mock_get(url, **kwargs):
        if "mentions/sentiment" in url:
            captured_params["sentiment"] = kwargs.get("params", {})
        if "daily-metrics" in url:
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    params = captured_params["sentiment"]
    assert "date_from" in params
    assert "date_to" in params
    # Should NOT use from/to for this endpoint
    assert "from" not in params
    assert "to" not in params


# ---------------------------------------------------------------------------
# Tests — published_at and external_id
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_published_at_is_utc_start_of_day(handler, mock_tenant, valid_config):
    """published_at should be start of day in UTC."""
    dates = ["2024-06-15"]

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response(_daily_metrics_response(dates))
        elif "mentions/sentiment" in url:
            return _make_mock_response(_sentiment_response(dates))
        elif "mentions/reach" in url:
            return _make_mock_response(_reach_response(dates))
        elif "topics" in url:
            return _make_mock_response(_topics_response())
        elif "project_events" in url:
            return _make_mock_response(_events_response([]))
        elif "domains" in url:
            return _make_mock_response(_domains_response())
        elif "trending-links" in url:
            return _make_mock_response(_trending_links_response())
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-06-15T00:00:00Z")

    assert len(results) == 1
    assert results[0].published_at == datetime(2024, 6, 15, tzinfo=timezone.utc)
    assert results[0].external_id == f"{FAKE_PROJECT_ID}_2024-06-15"


# ---------------------------------------------------------------------------
# Tests — empty daily metrics
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_empty_daily_metrics_returns_empty(handler, mock_tenant, valid_config):
    """If daily-metrics returns no days, result should be empty."""

    async def mock_get(url, **kwargs):
        if "daily-metrics" in url:
            return _make_mock_response({"status": "success", "data": {"days": []}})
        return _make_mock_response({"status": "success", "data": {}})

    with patch("handlers.brand24.httpx.AsyncClient") as mock_client_cls:
        client_instance = AsyncMock()
        client_instance.get = mock_get
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=client_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        results = await handler.fetch(valid_config, since="2024-01-01T00:00:00Z")

    assert results == []


# ---------------------------------------------------------------------------
# Tests — _parse_date helper
# ---------------------------------------------------------------------------


class TestParseDate:
    def test_valid_date(self):
        from handlers.brand24 import _parse_date

        result = _parse_date("2024-03-15")
        assert result == datetime(2024, 3, 15, tzinfo=timezone.utc)

    def test_none_returns_none(self):
        from handlers.brand24 import _parse_date

        assert _parse_date(None) is None

    def test_empty_string_returns_none(self):
        from handlers.brand24 import _parse_date

        assert _parse_date("") is None

    def test_invalid_format_returns_none(self):
        from handlers.brand24 import _parse_date

        assert _parse_date("not-a-date") is None
        assert _parse_date("2024/03/15") is None
        assert _parse_date("15-03-2024") is None
