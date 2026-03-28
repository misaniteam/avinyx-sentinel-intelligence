import structlog
import httpx
from datetime import datetime, timezone
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.database.session import tenant_context

logger = structlog.get_logger()

MAX_RESULTS = 500
MAX_PAGES = 3
BASE_URL = "https://api.brand24.com/v3/search"


class Brand24Handler(BaseConnectorHandler):
    """Handler for Brand24 API — social media mention tracking."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        api_key = config.get("api_key")
        project_id = config.get("project_id")

        if not api_key or not project_id:
            logger.error(
                "brand24_missing_config",
                has_key=bool(api_key),
                has_project=bool(project_id),
            )
            return []

        # Build search keywords by combining config search_queries with location keywords
        search_terms: list[str] = list(config.get("search_queries", []))
        if location_context and location_context.get("keywords"):
            search_terms.extend(location_context["keywords"])

        tid = tenant_context.get()
        headers = {"Authorization": f"Bearer {api_key}"}
        results: list[RawMediaItem] = []
        cursor: str | None = None

        logger.info(
            "brand24_fetch_start",
            project_id=project_id,
            since=since,
            search_terms_count=len(search_terms),
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for page in range(MAX_PAGES):
                    if len(results) >= MAX_RESULTS:
                        break

                    params: dict = {"projectId": project_id}
                    if since:
                        params["sinceDate"] = since
                    if search_terms:
                        params["keyword"] = " ".join(search_terms)
                    if cursor:
                        params["lastMentionId"] = cursor

                    try:
                        resp = await client.get(
                            BASE_URL, headers=headers, params=params
                        )
                        resp.raise_for_status()
                    except httpx.HTTPStatusError as exc:
                        logger.error(
                            "brand24_api_http_error",
                            status=exc.response.status_code,
                            page=page,
                            body=exc.response.text[:500],
                        )
                        break
                    except httpx.RequestError as exc:
                        logger.error(
                            "brand24_api_request_error", error=str(exc), page=page
                        )
                        break

                    body = resp.json()
                    mentions = body.get("data", [])

                    if not mentions:
                        logger.info("brand24_no_more_mentions", page=page)
                        break

                    for mention in mentions:
                        if len(results) >= MAX_RESULTS:
                            break

                        published_at = _parse_date(mention.get("date"))

                        item = RawMediaItem(
                            tenant_id=tid,
                            platform="brand24",
                            external_id=str(mention["id"]),
                            content=mention.get("text"),
                            author=mention.get("author"),
                            author_id=str(mention["authorId"])
                            if mention.get("authorId")
                            else None,
                            published_at=published_at,
                            url=mention.get("url"),
                            engagement={
                                "likes": mention.get("likes", 0),
                                "comments": mention.get("comments", 0),
                                "shares": mention.get("shares", 0),
                            },
                            raw_payload=mention,
                        )
                        results.append(item)

                    # Advance cursor for next page
                    cursor = body.get("nextCursor") or body.get("lastMentionId")
                    if not cursor:
                        break

                    logger.info(
                        "brand24_page_complete", page=page, items_so_far=len(results)
                    )

        except Exception as exc:
            logger.error(
                "brand24_unexpected_error", error=str(exc), items_collected=len(results)
            )

        logger.info("brand24_fetch_complete", total_items=len(results))
        return results


def _parse_date(date_str: str | None) -> datetime | None:
    """Parse a Brand24 date string into a timezone-aware datetime."""
    if not date_str:
        return None
    try:
        # Brand24 dates are typically ISO 8601
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        logger.warning("brand24_date_parse_failed", date_str=date_str)
        return None
