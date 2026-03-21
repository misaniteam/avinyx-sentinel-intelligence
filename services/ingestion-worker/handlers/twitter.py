import structlog
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger()


class TwitterHandler(BaseConnectorHandler):
    """Handler for Twitter / X API v2."""

    async def fetch(self, config: dict, since: str | None) -> list[RawMediaItem]:
        # TODO: Implement Twitter API v2 integration
        # config should contain: api_key, api_secret, bearer_token, search_queries
        logger.info("twitter_fetch", search_queries=config.get("search_queries"))
        return []
