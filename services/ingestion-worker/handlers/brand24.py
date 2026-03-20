import structlog
from datetime import datetime
from handlers.base import BaseConnectorHandler
from sentinel_shared.models.media import RawMediaItem
from sentinel_shared.database.session import tenant_context

logger = structlog.get_logger()

class Brand24Handler(BaseConnectorHandler):
    """Handler for Brand24 API (Facebook + Instagram mentions)."""

    async def fetch(self, config: dict, since: str | None) -> list[RawMediaItem]:
        # TODO: Implement Brand24 API integration
        # config should contain: api_key, project_id
        logger.info("brand24_fetch", project_id=config.get("project_id"))

        # Placeholder - will be implemented with actual Brand24 API
        return []
