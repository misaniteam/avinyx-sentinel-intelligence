import structlog
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger()


class NewsRSSHandler(BaseConnectorHandler):
    """Handler for RSS feed ingestion."""

    async def fetch(self, config: dict, since: str | None) -> list[RawMediaItem]:
        # TODO: Implement RSS feed parsing
        # config should contain: feed_urls
        logger.info("news_rss_fetch", feed_count=len(config.get("feed_urls", [])))
        return []
