"""News API connector handler."""

from datetime import datetime, timezone

import httpx
import structlog

from handlers.base import BaseConnectorHandler
from sentinel_shared.database.session import tenant_context
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger(__name__)

MAX_RESULTS = 500
MAX_PAGES = 3
PAGE_SIZE = 100
BASE_URL = "https://newsapi.org/v2/everything"
REQUEST_TIMEOUT = 30.0


class NewsAPIHandler(BaseConnectorHandler):
    """Fetches articles from the News API (newsapi.org)."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        api_key = config.get("api_key")
        if not api_key:
            logger.warning("news_api.no_api_key")
            return []

        # Build query from keywords + location context
        query_parts: list[str] = list(config.get("keywords", []))
        if location_context:
            query_parts.extend(location_context.get("keywords", []))
        if not query_parts:
            logger.warning("news_api.no_keywords")
            return []

        query = " OR ".join(query_parts)

        # Build sources param
        sources = config.get("sources")
        if isinstance(sources, list):
            sources = ",".join(sources)

        language = config.get("language", "en")
        current_tenant_id = tenant_context.get()
        items: list[RawMediaItem] = []

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for page in range(1, MAX_PAGES + 1):
                if len(items) >= MAX_RESULTS:
                    break
                try:
                    articles, total_results = await self._fetch_page(
                        client, api_key, query, sources, language, since, page
                    )
                    for article in articles:
                        if len(items) >= MAX_RESULTS:
                            break
                        item = self._article_to_item(article, current_tenant_id)
                        if item:
                            items.append(item)

                    # Stop if we've fetched all available results
                    fetched_so_far = page * PAGE_SIZE
                    if fetched_so_far >= total_results:
                        break

                except Exception:
                    logger.exception("news_api.page_error", page=page)
                    break

        return items[:MAX_RESULTS]

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        query: str,
        sources: str | None,
        language: str,
        since: str | None,
        page: int,
    ) -> tuple[list[dict], int]:
        params: dict = {
            "apiKey": api_key,
            "q": query,
            "language": language,
            "sortBy": "publishedAt",
            "pageSize": PAGE_SIZE,
            "page": page,
        }
        if sources:
            params["sources"] = sources
        if since:
            params["from"] = since

        response = await client.get(BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "ok":
            logger.error("news_api.api_error", message=data.get("message"))
            return [], 0

        articles = data.get("articles", [])
        total_results = data.get("totalResults", 0)
        return articles, total_results

    def _article_to_item(
        self, article: dict, current_tenant_id: str | None
    ) -> RawMediaItem | None:
        url = article.get("url")
        if not url:
            return None

        title = article.get("title", "")
        description = article.get("description", "")
        content = f"{title}\n{description}".strip()

        published_at: datetime | None = None
        raw_published = article.get("publishedAt")
        if raw_published:
            try:
                published_at = datetime.fromisoformat(
                    raw_published.replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        return RawMediaItem(
            tenant_id=current_tenant_id,
            platform="news_api",
            external_id=url,
            content=content,
            author=article.get("author"),
            published_at=published_at,
            url=url,
            engagement={},
            raw_payload=article,
        )
