from abc import ABC, abstractmethod
from datetime import datetime
from sentinel_shared.models.media import RawMediaItem

class BaseConnectorHandler(ABC):
    @abstractmethod
    async def fetch(self, config: dict, since: str | None, location_context: dict | None = None) -> list[RawMediaItem]:
        ...
