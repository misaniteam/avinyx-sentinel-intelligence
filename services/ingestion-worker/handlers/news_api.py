import structlog
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger()


class NewsAPIHandler(BaseConnectorHandler):
    """Handler for NewsAPI.org integration."""

    async def fetch(self, config: dict, since: str | None) -> list[RawMediaItem]:
        # TODO: Implement NewsAPI integration
        # config should contain: api_key, keywords, sources, language
        logger.info("news_api_fetch", keywords=config.get("keywords"))
        return []
