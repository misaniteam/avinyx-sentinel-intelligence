import structlog
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem

logger = structlog.get_logger()


class RedditHandler(BaseConnectorHandler):
    """Handler for Reddit API integration."""

    async def fetch(self, config: dict, since: str | None) -> list[RawMediaItem]:
        # TODO: Implement Reddit API integration
        # config should contain: client_id, client_secret, subreddits
        logger.info("reddit_fetch", subreddits=config.get("subreddits"))
        return []
