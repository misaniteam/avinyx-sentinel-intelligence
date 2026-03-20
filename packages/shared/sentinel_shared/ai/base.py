from abc import ABC, abstractmethod
from pydantic import BaseModel


class SentimentResult(BaseModel):
    sentiment_score: float  # -1.0 to 1.0
    sentiment_label: str  # positive, negative, neutral
    topics: list[str] = []
    entities: list[dict] = []
    summary: str = ""


class BaseAIProvider(ABC):
    @abstractmethod
    async def analyze_sentiment(self, texts: list[str]) -> list[SentimentResult]:
        ...

    @abstractmethod
    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        ...
