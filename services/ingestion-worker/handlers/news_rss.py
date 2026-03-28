"""News RSS feed connector handler."""

import asyncio
from datetime import datetime, timezone

import feedparser
import httpx
import structlog

from handlers.base import BaseConnectorHandler
from sentinel_shared.database.session import tenant_context
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger(__name__)

MAX_RESULTS = 500
REQUEST_TIMEOUT = 30.0


class NewsRSSHandler(BaseConnectorHandler):
    """Fetches and parses RSS feed entries."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        feed_urls: list[str] = config.get("feed_urls", [])
        if not feed_urls:
            logger.warning("news_rss.no_feed_urls")
            return []

        since_dt: datetime | None = None
        if since:
            try:
                since_dt = datetime.fromisoformat(since)
                if since_dt.tzinfo is None:
                    since_dt = since_dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                logger.warning("news_rss.invalid_since", since=since)

        location_keywords: list[str] = []
        if location_context:
            location_keywords = [
                kw.lower() for kw in location_context.get("keywords", []) if kw
            ]

        current_tenant_id = tenant_context.get()
        items: list[RawMediaItem] = []

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for url in feed_urls:
                if len(items) >= MAX_RESULTS:
                    break
                try:
                    feed_items = await self._fetch_feed(
                        client, url, since_dt, location_keywords, current_tenant_id
                    )
                    items.extend(feed_items)
                except Exception:
                    logger.exception("news_rss.feed_error", url=url)
                    continue

        return items[:MAX_RESULTS]

    async def _fetch_feed(
        self,
        client: httpx.AsyncClient,
        url: str,
        since_dt: datetime | None,
        location_keywords: list[str],
        current_tenant_id: str | None,
    ) -> list[RawMediaItem]:
        response = await client.get(url)
        response.raise_for_status()

        feed = await asyncio.to_thread(feedparser.parse, response.text)

        if feed.bozo and not feed.entries:
            logger.warning(
                "news_rss.parse_error", url=url, error=str(feed.bozo_exception)
            )
            return []

        items: list[RawMediaItem] = []
        location_filtered: list[RawMediaItem] = []

        for entry in feed.entries:
            external_id = entry.get("id") or entry.get("link")
            if not external_id:
                continue

            content = entry.get("summary") or entry.get("description", "")
            author = entry.get("author")
            entry_url = entry.get("link")

            published_at: datetime | None = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    published_at = datetime(
                        *entry.published_parsed[:6], tzinfo=timezone.utc
                    )
                except (TypeError, ValueError):
                    pass

            # Skip entries before the since cutoff
            if since_dt and published_at and published_at < since_dt:
                continue

            item = RawMediaItem(
                tenant_id=current_tenant_id,
                platform="news_rss",
                external_id=external_id,
                content=content,
                author=author,
                published_at=published_at,
                url=entry_url,
                engagement={},
                raw_payload=dict(entry),
            )

            items.append(item)

            # Track items matching location keywords
            if location_keywords and content:
                content_lower = content.lower()
                title_lower = entry.get("title", "").lower()
                combined = f"{content_lower} {title_lower}"
                if any(kw in combined for kw in location_keywords):
                    location_filtered.append(item)

        # If location keywords are provided and some entries match, return only those.
        # If no entries match, return all entries (avoid over-filtering).
        if location_keywords and location_filtered:
            return location_filtered

        return items
