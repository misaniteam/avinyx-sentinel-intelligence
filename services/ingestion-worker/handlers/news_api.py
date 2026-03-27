"""TheNewsAPI connector handler (thenewsapi.com)."""

from datetime import datetime, timezone

import httpx
import structlog

from handlers.base import BaseConnectorHandler
from sentinel_shared.database.session import tenant_context
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger(__name__)

MAX_RESULTS = 500
MAX_PAGES = 5
PAGE_SIZE = 50
BASE_URL = "https://api.thenewsapi.com/v1/news/all"
REQUEST_TIMEOUT = 30.0


class NewsAPIHandler(BaseConnectorHandler):
    """Fetches articles from TheNewsAPI (thenewsapi.com)."""

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

        # Build search query from keywords + location context
        query_parts: list[str] = list(config.get("keywords", []))
        if location_context:
            query_parts.extend(location_context.get("keywords", []))

        # TheNewsAPI uses | for OR operator
        search_query = " | ".join(query_parts) if query_parts else None

        categories = config.get("categories")
        if isinstance(categories, list):
            categories = ",".join(categories)

        domains = config.get("domains")
        if isinstance(domains, list):
            domains = ",".join(domains)

        language = config.get("language", "en")
        current_tenant_id = tenant_context.get()
        items: list[RawMediaItem] = []

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for page in range(1, MAX_PAGES + 1):
                if len(items) >= MAX_RESULTS:
                    break
                try:
                    articles, total_found = await self._fetch_page(
                        client, api_key, search_query, categories, domains,
                        language, since, page,
                    )
                    for article in articles:
                        if len(items) >= MAX_RESULTS:
                            break
                        item = self._article_to_item(article, current_tenant_id)
                        if item:
                            items.append(item)

                    # Stop if we've fetched all available results
                    fetched_so_far = page * PAGE_SIZE
                    if fetched_so_far >= total_found:
                        break

                except Exception:
                    logger.exception("news_api.page_error", page=page)
                    break

        return items[:MAX_RESULTS]

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        search_query: str | None,
        categories: str | None,
        domains: str | None,
        language: str,
        since: str | None,
        page: int,
    ) -> tuple[list[dict], int]:
        params: dict = {
            "api_token": api_key,
            "language": language,
            "sort": "published_at",
            "limit": PAGE_SIZE,
            "page": page,
        }
        if search_query:
            params["search"] = search_query
        if categories:
            params["categories"] = categories
        if domains:
            params["domains"] = domains
        if since:
            params["published_after"] = since

        response = await client.get(BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

        articles = data.get("data", [])
        meta = data.get("meta", {})
        total_found = meta.get("found", 0)
        return articles, total_found

    def _article_to_item(
        self, article: dict, current_tenant_id: str | None
    ) -> RawMediaItem | None:
        article_uuid = article.get("uuid")
        url = article.get("url")
        if not article_uuid or not url:
            return None

        title = article.get("title", "")
        description = article.get("description", "")
        content = f"{title}\n{description}".strip()

        published_at: datetime | None = None
        raw_published = article.get("published_at")
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
            external_id=article_uuid,
            content=content,
            author=article.get("source"),
            published_at=published_at,
            url=url,
            engagement={},
            raw_payload=article,
        )
