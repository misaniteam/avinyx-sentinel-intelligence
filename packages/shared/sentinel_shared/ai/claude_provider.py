import json
from anthropic import AsyncAnthropic
from sentinel_shared.ai.base import (
    BaseAIProvider,
    SentimentResult,
    ContentExtractionResult,
    build_topic_keywords_prompt,
)
from sentinel_shared.config import get_settings

ANALYZE_AND_EXTRACT_PROMPT = """Analyze this content and extract structured information. Return JSON with exactly two keys:

1. "sentiment": {{
  "sentiment_score": float from -1.0 (very negative) to 1.0 (very positive),
  "sentiment_label": "positive", "negative", or "neutral",
  "topics": list of topic strings,
  "entities": list of {{"name": string, "type": string}} objects,
  "summary": brief one-sentence summary
}}

2. "extraction": {{
  "title": a concise, descriptive title for this content (generate one if not obvious),
  "description": cleaned plain-text description (strip HTML tags and entities, max ~500 chars),
  "image_url": URL of the most relevant image found in the raw data (empty string if none),
  "source_link": the canonical URL to the original content (empty string if none),
  "external_links": list of any other URLs found (YouTube links, article links, etc.)
}}

Content text:
{text}

Raw platform data (may contain image URLs, links, metadata):
{raw_payload}

Return only valid JSON."""


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
                messages=[
                    {
                        "role": "user",
                        "content": f"""Analyze the sentiment of this text. Return JSON with:
- sentiment_score: float from -1.0 (very negative) to 1.0 (very positive)
- sentiment_label: "positive", "negative", or "neutral"
- topics: list of topic strings
- entities: list of {{name, type}} objects
- summary: brief summary

Text: {text}

Return only valid JSON.""",
                    }
                ],
            )
            try:
                data = json.loads(response.content[0].text)
                results.append(SentimentResult(**data))
            except (json.JSONDecodeError, KeyError, IndexError):
                results.append(
                    SentimentResult(
                        sentiment_score=0.0,
                        sentiment_label="neutral",
                        summary="Analysis failed",
                    )
                )
        return results

    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        results = []
        for text in texts:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=512,
                messages=[
                    {
                        "role": "user",
                        "content": f"Extract key topics from this text. Return a JSON array of topic strings.\n\nText: {text}\n\nReturn only a JSON array.",
                    }
                ],
            )
            try:
                topics = json.loads(response.content[0].text)
                results.append(topics if isinstance(topics, list) else [])
            except (json.JSONDecodeError, IndexError):
                results.append([])
        return results

    async def analyze_and_extract(
        self,
        texts: list[str],
        raw_payloads: list[dict | None],
        topic_keywords: list[dict] | None = None,
    ) -> list[tuple[SentimentResult, ContentExtractionResult]]:
        keyword_context = build_topic_keywords_prompt(topic_keywords)
        results = []
        for text, payload in zip(texts, raw_payloads):
            payload_str = json.dumps(payload or {}, default=str)[:2000]
            prompt_content = ANALYZE_AND_EXTRACT_PROMPT.format(
                text=text, raw_payload=payload_str
            )
            if keyword_context:
                prompt_content = prompt_content.replace(
                    "Return only valid JSON.",
                    keyword_context + "\n\nReturn only valid JSON.",
                )
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": prompt_content,
                    }
                ],
            )
            try:
                data = json.loads(response.content[0].text)
                sentiment = SentimentResult(**(data.get("sentiment", {})))
                extraction = ContentExtractionResult(**(data.get("extraction", {})))
                results.append((sentiment, extraction))
            except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                results.append(
                    (
                        SentimentResult(
                            sentiment_score=0.0,
                            sentiment_label="neutral",
                            summary="Analysis failed",
                        ),
                        ContentExtractionResult(),
                    )
                )
        return results
