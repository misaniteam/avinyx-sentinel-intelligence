import json
import asyncio
import structlog
from aiobotocore.session import get_session
from aiobotocore.config import AioConfig
from sentinel_shared.ai.base import (
    BaseAIProvider,
    SentimentResult,
    ContentExtractionResult,
    build_topic_keywords_prompt,
)
from sentinel_shared.config import get_settings

logger = structlog.get_logger()

MAX_RETRIES = 5
RETRY_BACKOFF_BASE = 2
INTER_REQUEST_DELAY = 3  # seconds between API calls to avoid throttling

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
        kwargs = {
            "region_name": self._region,
            "config": AioConfig(
                read_timeout=120,
                connect_timeout=10,
                retries={"max_attempts": 0},
            ),
        }
        # Use explicit credentials if provided, otherwise fall back to
        # default credential chain (ECS task role, instance profile, etc.)
        if self._access_key and self._secret_key:
            kwargs["endpoint_url"] = (
                f"https://bedrock-runtime.{self._region}.amazonaws.com"
            )
            kwargs["aws_access_key_id"] = self._access_key
            kwargs["aws_secret_access_key"] = self._secret_key
        return kwargs

    @staticmethod
    def _is_throttling_error(error: Exception) -> bool:
        """Check if the error is a Bedrock throttling/rate limit error."""
        error_str = str(error).lower()
        return any(
            term in error_str
            for term in (
                "throttl",
                "too many requests",
                "rate exceeded",
                "limit exceeded",
                "serviceunav",
                "modelerror",
            )
        )

    async def _invoke(
        self, system: str, user_content: str, max_tokens: int = 2048
    ) -> str:
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": 0,
                "system": system,
                "messages": [{"role": "user", "content": user_content}],
            }
        )

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with self._session.create_client(
                    "bedrock-runtime", **self._client_kwargs()
                ) as client:
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
                is_throttle = self._is_throttling_error(e)
                if attempt < MAX_RETRIES:
                    # Longer backoff for throttling errors
                    if is_throttle:
                        wait = RETRY_BACKOFF_BASE ** (attempt + 2)  # 4, 8, 16, 32, 64s
                    else:
                        wait = RETRY_BACKOFF_BASE ** (attempt + 1)  # 2, 4, 8, 16, 32s
                    logger.warning(
                        "bedrock_retry",
                        attempt=attempt + 1,
                        wait=wait,
                        throttled=is_throttle,
                        error=str(e),
                    )
                    await asyncio.sleep(wait)
                else:
                    raise

    async def analyze_sentiment(self, texts: list[str]) -> list[SentimentResult]:
        system = "You analyze text sentiment. Return JSON with: sentiment_score (float -1.0 to 1.0), sentiment_label (positive/negative/neutral), topics (list of strings), entities (list of {name, type} objects), summary (string). Return only valid JSON."
        results = []
        for i, text in enumerate(texts):
            if i > 0:
                await asyncio.sleep(INTER_REQUEST_DELAY)
            try:
                response_text = await self._invoke(system, text, max_tokens=1024)
                data = json.loads(response_text)
                results.append(SentimentResult(**data))
            except (json.JSONDecodeError, KeyError, TypeError):
                results.append(
                    SentimentResult(
                        sentiment_score=0.0,
                        sentiment_label="neutral",
                        summary="Analysis failed",
                    )
                )
            except Exception as e:
                logger.error(
                    "bedrock_sentiment_failed",
                    error=str(e),
                    throttled=self._is_throttling_error(e),
                )
                results.append(
                    SentimentResult(
                        sentiment_score=0.0,
                        sentiment_label="neutral",
                        summary="Analysis failed",
                    )
                )
                if self._is_throttling_error(e):
                    await asyncio.sleep(30)
        return results

    async def extract_topics(self, texts: list[str]) -> list[list[str]]:
        system = 'Extract key topics. Return JSON: {"topics": ["topic1", ...]}'
        results = []
        for i, text in enumerate(texts):
            if i > 0:
                await asyncio.sleep(INTER_REQUEST_DELAY)
            try:
                response_text = await self._invoke(system, text, max_tokens=512)
                data = json.loads(response_text)
                results.append(data.get("topics", []))
            except (json.JSONDecodeError, KeyError):
                results.append([])
            except Exception as e:
                logger.error(
                    "bedrock_topics_failed",
                    error=str(e),
                    throttled=self._is_throttling_error(e),
                )
                results.append([])
                if self._is_throttling_error(e):
                    await asyncio.sleep(30)
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
        for i, (text, payload) in enumerate(zip(texts, raw_payloads)):
            if i > 0:
                await asyncio.sleep(INTER_REQUEST_DELAY)
            payload_str = json.dumps(payload or {}, default=str)[:2000]
            user_content = f"Content text:\n{text}\n\nRaw platform data:\n{payload_str}"
            try:
                response_text = await self._invoke(
                    system_prompt, user_content, max_tokens=2048
                )
                data = json.loads(response_text)
                sentiment = SentimentResult(**(data.get("sentiment", {})))
                extraction = ContentExtractionResult(**(data.get("extraction", {})))
                results.append((sentiment, extraction))
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
                logger.error(
                    "bedrock_parse_failed",
                    error=str(e),
                    response_preview=response_text[:500]
                    if "response_text" in dir()
                    else "no response",
                )
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
            except Exception as e:
                # Throttling or other API errors — log, add fallback, and add extra cooldown
                is_throttle = self._is_throttling_error(e)
                logger.error(
                    "bedrock_invoke_failed",
                    error=str(e),
                    throttled=is_throttle,
                    item_index=i,
                )
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
                if is_throttle:
                    # Back off significantly before attempting the next item
                    await asyncio.sleep(30)
        return results
