import structlog
import httpx
from datetime import datetime, timezone
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.database.session import tenant_context

logger = structlog.get_logger()

MAX_RESULTS = 500
MAX_PAGES = 3
SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent"
PAGE_SIZE = 100


class TwitterHandler(BaseConnectorHandler):
    """Handler for Twitter/X API v2 — recent tweet search."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        bearer_token = config.get("bearer_token")
        if not bearer_token:
            logger.error("twitter_missing_bearer_token")
            return []

        # Build query: join search_queries with OR, append location keywords
        search_queries: list[str] = list(config.get("search_queries", []))
        if location_context and location_context.get("keywords"):
            search_queries.extend(location_context["keywords"])

        if not search_queries:
            logger.warning("twitter_no_search_queries")
            return []

        query = " OR ".join(search_queries)
        tid = tenant_context.get()
        headers = {"Authorization": f"Bearer {bearer_token}"}
        results: list[RawMediaItem] = []
        next_token: str | None = None

        logger.info("twitter_fetch_start", query=query, since=since)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for page in range(MAX_PAGES):
                    if len(results) >= MAX_RESULTS:
                        break

                    params: dict = {
                        "query": query,
                        "tweet.fields": "created_at,author_id,public_metrics",
                        "expansions": "author_id",
                        "user.fields": "name,username",
                        "max_results": PAGE_SIZE,
                    }
                    if since:
                        params["start_time"] = since
                    if next_token:
                        params["next_token"] = next_token

                    try:
                        resp = await client.get(
                            SEARCH_URL, headers=headers, params=params
                        )
                        resp.raise_for_status()
                    except httpx.HTTPStatusError as exc:
                        logger.error(
                            "twitter_api_http_error",
                            status=exc.response.status_code,
                            page=page,
                            body=exc.response.text[:500],
                        )
                        break
                    except httpx.RequestError as exc:
                        logger.error(
                            "twitter_api_request_error", error=str(exc), page=page
                        )
                        break

                    body = resp.json()
                    tweets = body.get("data", [])

                    if not tweets:
                        logger.info("twitter_no_more_tweets", page=page)
                        break

                    # Build author lookup from includes.users
                    author_lookup: dict[str, dict] = {}
                    includes = body.get("includes", {})
                    for user in includes.get("users", []):
                        author_lookup[user["id"]] = {
                            "name": user.get("name"),
                            "username": user.get("username"),
                        }

                    for tweet in tweets:
                        if len(results) >= MAX_RESULTS:
                            break

                        tweet_id = tweet["id"]
                        author_id = tweet.get("author_id")
                        author_info = author_lookup.get(author_id, {})
                        metrics = tweet.get("public_metrics", {})
                        published_at = _parse_date(tweet.get("created_at"))

                        item = RawMediaItem(
                            tenant_id=tid,
                            platform="twitter",
                            external_id=tweet_id,
                            content=tweet.get("text"),
                            author=author_info.get("name"),
                            author_id=author_id,
                            published_at=published_at,
                            url=f"https://twitter.com/i/status/{tweet_id}",
                            engagement={
                                "likes": metrics.get("like_count", 0),
                                "retweets": metrics.get("retweet_count", 0),
                                "replies": metrics.get("reply_count", 0),
                            },
                            raw_payload=tweet,
                        )
                        results.append(item)

                    # Pagination via meta.next_token
                    meta = body.get("meta", {})
                    next_token = meta.get("next_token")
                    if not next_token:
                        break

                    logger.info(
                        "twitter_page_complete", page=page, items_so_far=len(results)
                    )

        except Exception as exc:
            logger.error(
                "twitter_unexpected_error", error=str(exc), items_collected=len(results)
            )

        logger.info("twitter_fetch_complete", total_items=len(results))
        return results


def _parse_date(date_str: str | None) -> datetime | None:
    """Parse an ISO 8601 date string into a timezone-aware datetime."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        logger.warning("twitter_date_parse_failed", date_str=date_str)
        return None
