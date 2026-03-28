import json
from openai import AsyncOpenAI
from sentinel_shared.ai.base import (
    BaseAIProvider,
    SentimentResult,
    ContentExtractionResult,
    build_topic_keywords_prompt,
)
from sentinel_shared.config import get_settings

ANALYZE_AND_EXTRACT_SYSTEM = """You analyze content and extract structured information. Return JSON with exactly two keys:
1. "sentiment": {"sentiment_score": float -1.0 to 1.0, "sentiment_label": "positive"/"negative"/"neutral", "topics": [strings], "entities": [{"name": string, "type": string}], "summary": string}
2. "extraction": {"title": string (concise title, generate if not obvious), "description": string (cleaned plain text, max ~500 chars), "image_url": string (most relevant image URL or ""), "source_link": string (canonical URL or ""), "external_links": [URLs found in content]}"""


class OpenAIProvider(BaseAIProvider):
    def __init__(self, model: str = "gpt-4o", **kwargs):
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = model

    async def analyze_sentiment(self, texts: list[str]) -> list[SentimentResult]:
        results = []
        for text in texts:
            response = await self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": "You analyze text sentiment. Return JSON with: sentiment_score (float -1.0 to 1.0), sentiment_label (positive/negative/neutral), topics (list of strings), entities (list of {name, type} objects), summary (string).",
                    },
                    {"role": "user", "content": text},
                ],
            )
            try:
                data = json.loads(response.choices[0].message.content)
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
            response = await self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": 'Extract key topics. Return JSON: {"topics": ["topic1", ...]}',
                    },
                    {"role": "user", "content": text},
                ],
            )
            try:
                data = json.loads(response.choices[0].message.content)
                results.append(data.get("topics", []))
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
        system_prompt = (
            ANALYZE_AND_EXTRACT_SYSTEM + keyword_context
            if keyword_context
            else ANALYZE_AND_EXTRACT_SYSTEM
        )
        results = []
        for text, payload in zip(texts, raw_payloads):
            payload_str = json.dumps(payload or {}, default=str)[:2000]
            response = await self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Content text:\n{text}\n\nRaw platform data:\n{payload_str}",
                    },
                ],
            )
            try:
                data = json.loads(response.choices[0].message.content)
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
