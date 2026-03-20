from handlers.base import BaseConnectorHandler
from handlers.brand24 import Brand24Handler
from handlers.youtube import YouTubeHandler

_registry: dict[str, BaseConnectorHandler] = {
    "brand24": Brand24Handler(),
    "youtube": YouTubeHandler(),
}

def get_handler(platform: str) -> BaseConnectorHandler | None:
    return _registry.get(platform)
