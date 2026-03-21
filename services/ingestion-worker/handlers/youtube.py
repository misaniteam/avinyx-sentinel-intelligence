import structlog
import httpx
from datetime import datetime, timezone
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.database.session import tenant_context

logger = structlog.get_logger()

MAX_RESULTS = 500
MAX_PAGES = 3
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
SEARCH_PAGE_SIZE = 50
STATS_BATCH_SIZE = 50


class YouTubeHandler(BaseConnectorHandler):
    """Handler for YouTube Data API v3 — video search and statistics."""

    async def fetch(
        self,
        config: dict,
        since: str | None,
        location_context: dict | None = None,
    ) -> list[RawMediaItem]:
        api_key = config.get("api_key")
        if not api_key:
            logger.error("youtube_missing_api_key")
            return []

        # Build combined query from search_queries + location keywords
        query_parts: list[str] = list(config.get("search_queries", []))
        if location_context and location_context.get("keywords"):
            query_parts.extend(location_context["keywords"])

        channel_ids: list[str] = config.get("channel_ids", [])
        tid = tenant_context.get()

        # Collect raw search results (snippet data + video IDs)
        raw_items: list[dict] = []

        logger.info(
            "youtube_fetch_start",
            query_parts_count=len(query_parts),
            channel_ids_count=len(channel_ids),
            since=since,
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if channel_ids:
                    # Search per channel
                    for ch_id in channel_ids:
                        if len(raw_items) >= MAX_RESULTS:
                            break
                        items = await self._search(
                            client, api_key, query_parts, since, channel_id=ch_id
                        )
                        raw_items.extend(items)
                elif query_parts:
                    # Search by query only
                    raw_items = await self._search(client, api_key, query_parts, since)
                else:
                    logger.warning("youtube_no_search_criteria")
                    return []

                # Cap at MAX_RESULTS
                raw_items = raw_items[:MAX_RESULTS]

                # Batch-fetch video statistics
                video_ids = [item["video_id"] for item in raw_items]
                stats_map = await self._fetch_stats(client, api_key, video_ids)

        except Exception as exc:
            logger.error("youtube_unexpected_error", error=str(exc), items_collected=len(raw_items))
            # Build results from whatever we collected so far (no stats)
            stats_map = {}

        # Build RawMediaItem list
        results: list[RawMediaItem] = []
        for item in raw_items:
            vid = item["video_id"]
            snippet = item["snippet"]
            stats = stats_map.get(vid, {})

            published_at = _parse_date(snippet.get("publishedAt"))

            media_item = RawMediaItem(
                tenant_id=tid,
                platform="youtube",
                external_id=vid,
                content=f"{snippet.get('title', '')}\n{snippet.get('description', '')}".strip(),
                author=snippet.get("channelTitle"),
                author_id=snippet.get("channelId"),
                published_at=published_at,
                url=f"https://www.youtube.com/watch?v={vid}",
                engagement={
                    "views": int(stats.get("viewCount", 0)),
                    "likes": int(stats.get("likeCount", 0)),
                    "comments": int(stats.get("commentCount", 0)),
                },
                raw_payload=item.get("raw"),
            )
            results.append(media_item)

        logger.info("youtube_fetch_complete", total_items=len(results))
        return results

    async def _search(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        query_parts: list[str],
        since: str | None,
        channel_id: str | None = None,
    ) -> list[dict]:
        """Run paginated YouTube search, returning up to MAX_PAGES of results."""
        query = " | ".join(query_parts) if query_parts else ""
        items: list[dict] = []
        page_token: str | None = None

        for page in range(MAX_PAGES):
            if len(items) >= MAX_RESULTS:
                break

            params: dict = {
                "part": "snippet",
                "type": "video",
                "key": api_key,
                "maxResults": SEARCH_PAGE_SIZE,
            }
            if query:
                params["q"] = query
            if since:
                params["publishedAfter"] = since
            if channel_id:
                params["channelId"] = channel_id
            if page_token:
                params["pageToken"] = page_token

            try:
                resp = await client.get(SEARCH_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "youtube_search_http_error",
                    status=exc.response.status_code,
                    page=page,
                    body=exc.response.text[:500],
                )
                break
            except httpx.RequestError as exc:
                logger.error("youtube_search_request_error", error=str(exc), page=page)
                break

            body = resp.json()
            search_items = body.get("items", [])

            for si in search_items:
                video_id = si.get("id", {}).get("videoId")
                if not video_id:
                    continue
                items.append({
                    "video_id": video_id,
                    "snippet": si.get("snippet", {}),
                    "raw": si,
                })

            page_token = body.get("nextPageToken")
            if not page_token:
                break

            logger.info("youtube_search_page_complete", page=page, items_so_far=len(items))

        return items

    async def _fetch_stats(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        video_ids: list[str],
    ) -> dict[str, dict]:
        """Batch-fetch video statistics, up to 50 IDs per request."""
        stats_map: dict[str, dict] = {}

        for i in range(0, len(video_ids), STATS_BATCH_SIZE):
            batch = video_ids[i : i + STATS_BATCH_SIZE]
            params = {
                "part": "statistics",
                "key": api_key,
                "id": ",".join(batch),
            }

            try:
                resp = await client.get(VIDEOS_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "youtube_stats_http_error",
                    status=exc.response.status_code,
                    batch_start=i,
                    body=exc.response.text[:500],
                )
                continue
            except httpx.RequestError as exc:
                logger.error("youtube_stats_request_error", error=str(exc), batch_start=i)
                continue

            body = resp.json()
            for item in body.get("items", []):
                vid = item.get("id")
                if vid:
                    stats_map[vid] = item.get("statistics", {})

        return stats_map


def _parse_date(date_str: str | None) -> datetime | None:
    """Parse an ISO 8601 / RFC 3339 date string into a timezone-aware datetime."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        logger.warning("youtube_date_parse_failed", date_str=date_str)
        return None
