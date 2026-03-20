import json
from openai import AsyncOpenAI
from sentinel_shared.ai.base import BaseAIProvider, SentimentResult
from sentinel_shared.config import get_settings


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
                    {"role": "system", "content": "You analyze text sentiment. Return JSON with: sentiment_score (float -1.0 to 1.0), sentiment_label (positive/negative/neutral), topics (list of strings), entities (list of {name, type} objects), summary (string)."},
                    {"role": "user", "content": text},
                ],
            )
            try:
                data = json.loads(response.choices[0].message.content)
                results.append(SentimentResult(**data))
            except (json.JSONDecodeError, KeyError, IndexError):
                results.append(SentimentResult(sentiment_score=0.0, sentiment_label="neutral", summary="Analysis failed"))
        return results

    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        results = []
        for text in texts:
            response = await self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Extract key topics. Return JSON: {\"topics\": [\"topic1\", ...]}"},
                    {"role": "user", "content": text},
                ],
            )
            try:
                data = json.loads(response.choices[0].message.content)
                results.append(data.get("topics", []))
            except (json.JSONDecodeError, IndexError):
                results.append([])
        return results
