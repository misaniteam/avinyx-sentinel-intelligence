import json
import asyncio
import structlog
from aiobotocore.session import get_session
from aiobotocore.config import AioConfig
from sentinel_shared.ai.base import BaseAIProvider, SentimentResult, ContentExtractionResult, build_topic_keywords_prompt
from sentinel_shared.config import get_settings

logger = structlog.get_logger()

MAX_RETRIES = 4
RETRY_BACKOFF_BASE = 3

ANALYZE_AND_EXTRACT_SYSTEM = """You analyze content and extract structured information. Return JSON with exactly two keys:
1. "sentiment": {"sentiment_score": float -1.0 to 1.0, "sentiment_label": "positive"/"negative"/"neutral", "topics": [strings], "entities": [{"name": string, "type": string}], "summary": string}
2. "extraction": {"title": string (concise title, generate if not obvious), "description": string (cleaned plain text, max ~500 chars), "image_url": string (most relevant image URL or ""), "source_link": string (canonical URL or ""), "external_links": [URLs found in content]}
Return only valid JSON."""


class BedrockProvider(BaseAIProvider):
    def __init__(self, model: str | None = None, **kwargs):
        settings = get_settings()
        self.model = model or settings.bedrock_voter_model_id
        self._session = get_session()
        self._region = settings.aws_textract_region
        self._access_key = settings.aws_textract_access_key_id
        self._secret_key = settings.aws_textract_secret_access_key

    def _client_kwargs(self):
        return {
            "region_name": self._region,
            "endpoint_url": f"https://bedrock-runtime.{self._region}.amazonaws.com",
            "aws_access_key_id": self._access_key,
            "aws_secret_access_key": self._secret_key,
            "config": AioConfig(
                read_timeout=120,
                connect_timeout=10,
                retries={"max_attempts": 0},
            ),
        }

    async def _invoke(self, system: str, user_content: str, max_tokens: int = 2048) -> str:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": 0,
            "system": system,
            "messages": [{"role": "user", "content": user_content}],
        })

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with self._session.create_client("bedrock-runtime", **self._client_kwargs()) as client:
                    response = await client.invoke_model(
                        modelId=self.model,
                        body=body,
                        contentType="application/json",
                        accept="application/json",
                    )
                    response_body = await response["body"].read()
                result = json.loads(response_body)
                text = result["content"][0]["text"]
                # Strip markdown code fences if present
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    text = text.strip()
                return text
            except Exception as e:
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_BASE ** (attempt + 1)
                    logger.warning("bedrock_retry", attempt=attempt + 1, wait=wait, error=str(e))
                    await asyncio.sleep(wait)
                else:
                    raise

    async def analyze_sentiment(self, texts: list[str]) -> list[SentimentResult]:
        system = "You analyze text sentiment. Return JSON with: sentiment_score (float -1.0 to 1.0), sentiment_label (positive/negative/neutral), topics (list of strings), entities (list of {name, type} objects), summary (string). Return only valid JSON."
        results = []
        for text in texts:
            try:
                response_text = await self._invoke(system, text, max_tokens=1024)
                data = json.loads(response_text)
                results.append(SentimentResult(**data))
            except (json.JSONDecodeError, KeyError, TypeError):
                results.append(SentimentResult(sentiment_score=0.0, sentiment_label="neutral", summary="Analysis failed"))
        return results

    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        system = 'Extract key topics. Return JSON: {"topics": ["topic1", ...]}'
        results = []
        for text in texts:
            try:
                response_text = await self._invoke(system, text, max_tokens=512)
                data = json.loads(response_text)
                results.append(data.get("topics", []))
            except (json.JSONDecodeError, KeyError):
                results.append([])
        return results

    async def analyze_and_extract(
        self, texts: list[str], raw_payloads: list[dict | None],
        topic_keywords: list[dict] | None = None,
    ) -> list[tuple[SentimentResult, ContentExtractionResult]]:
        keyword_context = build_topic_keywords_prompt(topic_keywords)
        system_prompt = ANALYZE_AND_EXTRACT_SYSTEM + keyword_context if keyword_context else ANALYZE_AND_EXTRACT_SYSTEM
        results = []
        for i, (text, payload) in enumerate(zip(texts, raw_payloads)):
            if i > 0:
                await asyncio.sleep(1)  # Avoid Bedrock throttling
            payload_str = json.dumps(payload or {}, default=str)[:2000]
            user_content = f"Content text:\n{text}\n\nRaw platform data:\n{payload_str}"
            try:
                response_text = await self._invoke(system_prompt, user_content, max_tokens=2048)
                data = json.loads(response_text)
                sentiment = SentimentResult(**(data.get("sentiment", {})))
                extraction = ContentExtractionResult(**(data.get("extraction", {})))
                results.append((sentiment, extraction))
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
                logger.error("bedrock_parse_failed", error=str(e), response_preview=response_text[:500] if 'response_text' in dir() else "no response")
                results.append((
                    SentimentResult(sentiment_score=0.0, sentiment_label="neutral", summary="Analysis failed"),
                    ContentExtractionResult(),
                ))
        return results
