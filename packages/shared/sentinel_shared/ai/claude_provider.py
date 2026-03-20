import json
from anthropic import AsyncAnthropic
from sentinel_shared.ai.base import BaseAIProvider, SentimentResult
from sentinel_shared.config import get_settings


class ClaudeProvider(BaseAIProvider):
    def __init__(self, model: str = "claude-sonnet-4-20250514", **kwargs):
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = model

    async def analyze_sentiment(self, texts: list[str]) -> list[SentimentResult]:
        results = []
        for text in texts:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": f"""Analyze the sentiment of this text. Return JSON with:
- sentiment_score: float from -1.0 (very negative) to 1.0 (very positive)
- sentiment_label: "positive", "negative", or "neutral"
- topics: list of topic strings
- entities: list of {{name, type}} objects
- summary: brief summary

Text: {text}

Return only valid JSON."""
                }],
            )
            try:
                data = json.loads(response.content[0].text)
                results.append(SentimentResult(**data))
            except (json.JSONDecodeError, KeyError, IndexError):
                results.append(SentimentResult(
                    sentiment_score=0.0,
                    sentiment_label="neutral",
                    summary="Analysis failed",
                ))
        return results

    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        results = []
        for text in texts:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": f"Extract key topics from this text. Return a JSON array of topic strings.\n\nText: {text}\n\nReturn only a JSON array."
                }],
            )
            try:
                topics = json.loads(response.content[0].text)
                results.append(topics if isinstance(topics, list) else [])
            except (json.JSONDecodeError, IndexError):
                results.append([])
        return results
