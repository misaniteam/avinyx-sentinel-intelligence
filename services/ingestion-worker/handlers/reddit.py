import structlog
import httpx
from datetime import datetime, timezone
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.database.session import tenant_context

logger = structlog.get_logger()

MAX_RESULTS = 500
MAX_PAGES = 3
PAGE_SIZE = 100
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
SEARCH_URL = "https://oauth.reddit.com/search.json"
USER_AGENT = "sentinel-intelligence:1.0 (by /u/sentinel-bot)"


class RedditHandler(BaseConnectorHandler):
    """Handler for Reddit API integration using OAuth2 client credentials."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        client_id = config.get("client_id")
        client_secret = config.get("client_secret")
        if not client_id or not client_secret:
            logger.error("reddit_missing_credentials")
            return []

        # Build search query from subreddits + location keywords
        subreddits: list[str] = list(config.get("subreddits", []))
        query_parts: list[str] = list(subreddits)
        if location_context and location_context.get("keywords"):
            query_parts.extend(location_context["keywords"])

        if not query_parts:
            logger.warning("reddit_no_search_terms")
            return []

        query = " OR ".join(query_parts)
        tid = tenant_context.get()
        results: list[RawMediaItem] = []

        logger.info("reddit_fetch_start", query=query, since=since)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Authenticate with OAuth2 client credentials
                access_token = await self._authenticate(client, client_id, client_secret)
                if not access_token:
                    return []

                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "User-Agent": USER_AGENT,
                }
                after: str | None = None

                for page in range(MAX_PAGES):
                    if len(results) >= MAX_RESULTS:
                        break

                    params: dict = {
                        "q": query,
                        "sort": "new",
                        "limit": PAGE_SIZE,
                        "t": "week",
                    }
                    if after:
                        params["after"] = after

                    try:
                        resp = await client.get(SEARCH_URL, headers=headers, params=params)
                        resp.raise_for_status()
                    except httpx.HTTPStatusError as exc:
                        logger.error(
                            "reddit_api_http_error",
                            status=exc.response.status_code,
                            page=page,
                            body=exc.response.text[:500],
                        )
                        break
                    except httpx.RequestError as exc:
                        logger.error("reddit_api_request_error", error=str(exc), page=page)
                        break

                    body = resp.json()
                    data = body.get("data", {})
                    children = data.get("children", [])

                    if not children:
                        logger.info("reddit_no_more_posts", page=page)
                        break

                    for child in children:
                        if len(results) >= MAX_RESULTS:
                            break

                        post = child.get("data", {})
                        post_id = post.get("id")
                        if not post_id:
                            continue

                        # Filter by since date if provided
                        created_utc = post.get("created_utc")
                        published_at = _parse_timestamp(created_utc)
                        if since and published_at:
                            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
                            if published_at < since_dt:
                                continue

                        title = post.get("title", "")
                        selftext = post.get("selftext", "")
                        content = f"{title}\n{selftext}".strip() if selftext else title

                        permalink = post.get("permalink", "")

                        item = RawMediaItem(
                            tenant_id=tid,
                            platform="reddit",
                            external_id=post_id,
                            content=content,
                            author=post.get("author"),
                            author_id=post.get("author"),
                            published_at=published_at,
                            url=f"https://www.reddit.com{permalink}" if permalink else None,
                            engagement={
                                "upvotes": post.get("ups", 0),
                                "comments": post.get("num_comments", 0),
                                "score": post.get("score", 0),
                            },
                            raw_payload=post,
                        )
                        results.append(item)

                    # Pagination
                    after = data.get("after")
                    if not after:
                        break

                    logger.info("reddit_page_complete", page=page, items_so_far=len(results))

        except Exception as exc:
            logger.error("reddit_unexpected_error", error=str(exc), items_collected=len(results))

        logger.info("reddit_fetch_complete", total_items=len(results))
        return results

    async def _authenticate(
        self,
        client: httpx.AsyncClient,
        client_id: str,
        client_secret: str,
    ) -> str | None:
        """Obtain OAuth2 access token via client credentials grant."""
        try:
            resp = await client.post(
                TOKEN_URL,
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            token_data = resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                logger.error("reddit_auth_no_token", response=token_data)
                return None
            return access_token
        except httpx.HTTPStatusError as exc:
            logger.error(
                "reddit_auth_http_error",
                status=exc.response.status_code,
                body=exc.response.text[:500],
            )
            return None
        except httpx.RequestError as exc:
            logger.error("reddit_auth_request_error", error=str(exc))
            return None


def _parse_timestamp(ts: float | None) -> datetime | None:
    """Convert a Unix timestamp to a timezone-aware datetime."""
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        logger.warning("reddit_timestamp_parse_failed", timestamp=ts)
        return None
