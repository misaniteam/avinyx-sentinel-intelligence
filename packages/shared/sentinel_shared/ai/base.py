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

    positive_topics = [tk for tk in topic_keywords if tk["sentiment_direction"] == "positive"]
    negative_topics = [tk for tk in topic_keywords if tk["sentiment_direction"] == "negative"]
    neutral_topics = [tk for tk in topic_keywords if tk["sentiment_direction"] == "neutral"]

    lines = [
        "\n\nCRITICAL — PERSPECTIVE-BASED SENTIMENT ANALYSIS:"
        "\nYou MUST analyze sentiment from the user's specific perspective, NOT from a general/neutral viewpoint."
        "\nThe user is a political organization. They have defined which people, topics, and keywords they support or oppose."
        "\nSentiment must reflect whether the content is FAVORABLE or UNFAVORABLE to the user's interests."
    ]

    if positive_topics:
        lines.append("\nENTITIES/TOPICS THE USER SUPPORTS (score these POSITIVELY when content is favorable to them):")
        for tk in positive_topics:
            keywords = ", ".join(tk["keywords"]) if tk["keywords"] else ""
            lines.append(f'  - "{tk["name"]}"{f" (keywords: {keywords})" if keywords else ""}')
        lines.append(
            "  Rules for SUPPORTED entities:"
            "\n  - Content where they take action, make promises, warn people, criticize opponents → POSITIVE"
            "\n  - Content where they are praised, achieve something, gain support → POSITIVE"
            "\n  - Content where they are attacked, criticized, face setbacks → NEGATIVE (bad for the user)"
            "\n  - Neutral mentions or factual reporting about them → slightly POSITIVE"
        )

    if negative_topics:
        lines.append("\nENTITIES/TOPICS THE USER OPPOSES (score these NEGATIVELY when content is favorable to them):")
        for tk in negative_topics:
            keywords = ", ".join(tk["keywords"]) if tk["keywords"] else ""
            lines.append(f'  - "{tk["name"]}"{f" (keywords: {keywords})" if keywords else ""}')
        lines.append(
            "  Rules for OPPOSED entities:"
            "\n  - Content where they face criticism, scandals, failures → POSITIVE (good for the user)"
            "\n  - Content where they succeed, gain support, look good → NEGATIVE (bad for the user)"
            "\n  - Neutral mentions → slightly NEGATIVE"
        )

    if neutral_topics:
        lines.append("\nNEUTRAL TOPICS (analyze based on general sentiment):")
        for tk in neutral_topics:
            keywords = ", ".join(tk["keywords"]) if tk["keywords"] else ""
            lines.append(f'  - "{tk["name"]}"{f" (keywords: {keywords})" if keywords else ""}')

    lines.append(
        "\nINCLUDE matched topic/entity names in the \"topics\" list."
        "\nThe sentiment_score MUST reflect the user's perspective as defined above."
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
