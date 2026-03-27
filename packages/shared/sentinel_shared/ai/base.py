from abc import ABC, abstractmethod
from pydantic import BaseModel


class SentimentResult(BaseModel):
    sentiment_score: float  # -1.0 to 1.0
    sentiment_label: str  # positive, negative, neutral
    topics: list[str] = []
    entities: list[dict] = []
    summary: str = ""


class ContentExtractionResult(BaseModel):
    title: str = ""
    description: str = ""
    image_url: str = ""
    source_link: str = ""
    external_links: list[str] = []


def build_topic_keywords_prompt(topic_keywords: list[dict] | None) -> str:
    """Build a prompt section for tenant-defined topic keywords with sentiment guidance."""
    if not topic_keywords:
        return ""
    lines = [
        "\n\nIMPORTANT CONTEXT — The user has defined the following topics with sentiment guidance:"
    ]
    for tk in topic_keywords:
        direction = tk["sentiment_direction"].upper()
        keywords = ", ".join(tk["keywords"]) if tk["keywords"] else "(no specific keywords)"
        lines.append(f'- "{tk["name"]}" ({direction}): keywords: {keywords}')
    lines.append(
        "\nWhen analyzing sentiment:"
        "\n1. Check if the content matches any of the defined keywords"
        "\n2. If it matches, weight the sentiment score toward the defined direction"
        "\n3. Include matched topic names in the \"topics\" list"
        "\n4. Still use your own judgment for the final score — the keywords provide direction, not absolute override"
    )
    return "\n".join(lines)


class BaseAIProvider(ABC):
    @abstractmethod
    async def analyze_sentiment(self, texts: list[str]) -> list[SentimentResult]:
        ...

    @abstractmethod
    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        ...

    @abstractmethod
    async def analyze_and_extract(
        self, texts: list[str], raw_payloads: list[dict | None],
        topic_keywords: list[dict] | None = None,
    ) -> list[tuple[SentimentResult, ContentExtractionResult]]:
        ...
