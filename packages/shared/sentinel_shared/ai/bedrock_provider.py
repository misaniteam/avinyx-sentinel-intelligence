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
BATCH_SIZE = 5  # Max items per single Bedrock API call

ANALYZE_AND_EXTRACT_SYSTEM = """You analyze content and extract structured information. Return JSON with exactly two keys:
1. "sentiment": {"sentiment_score": float -1.0 to 1.0, "sentiment_label": "positive"/"negative"/"neutral", "topics": [strings], "entities": [{"name": string, "type": string}], "summary": string}
2. "extraction": {"title": string (concise title, generate if not obvious), "description": string (cleaned plain text, max ~500 chars), "image_url": string (most relevant image URL or ""), "source_link": string (canonical URL or ""), "external_links": [URLs found in content]}
Return only valid JSON."""

ANALYZE_AND_EXTRACT_BATCH_SYSTEM = """You analyze multiple content items and extract structured information for each.
You will receive multiple items, each labeled with an index (ITEM 0, ITEM 1, etc.).
Return a JSON object with a single key "results" containing an array. Each element corresponds to one input item in order.
Each element must have exactly two keys:
1. "sentiment": {"sentiment_score": float -1.0 to 1.0, "sentiment_label": "positive"/"negative"/"neutral", "topics": [strings], "entities": [{"name": string, "type": string}], "summary": string}
2. "extraction": {"title": string (concise title, generate if not obvious), "description": string (cleaned plain text, max ~500 chars), "image_url": string (most relevant image URL or ""), "source_link": string (canonical URL or ""), "external_links": [URLs found in content]}
The "results" array MUST have exactly the same number of elements as input items. Return only valid JSON."""


class BedrockProvider(BaseAIProvider):
    def __init__(self, model: str | None = None, **kwargs):
        settings = get_settings()
        self.model = model or "apac.anthropic.claude-sonnet-4-20250514-v1:0"
        self._session = get_session()
        self._region = settings.aws_bedrock_region

    def _client_kwargs(self):
        kwargs = {
            "region_name": self._region,
            "config": AioConfig(
                read_timeout=120,
                connect_timeout=10,
                retries={"max_attempts": 0},
            ),
        }
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

    @staticmethod
    def _build_batch_user_content(
        texts: list[str], raw_payloads: list[dict | None]
    ) -> str:
        parts = []
        for i, (text, payload) in enumerate(zip(texts, raw_payloads)):
            payload_str = json.dumps(payload or {}, default=str)[:2000]
            parts.append(
                f"--- ITEM {i} ---\nContent text:\n{text}\n\nRaw platform data:\n{payload_str}"
            )
        return "\n\n".join(parts)

    @staticmethod
    def _parse_batch_response(
        response_text: str, expected_count: int
    ) -> list[tuple[SentimentResult, ContentExtractionResult]] | None:
        try:
            data = json.loads(response_text)
            items = data.get("results", data) if isinstance(data, dict) else data
            if not isinstance(items, list) or len(items) != expected_count:
                logger.warning(
                    "batch_count_mismatch",
                    expected=expected_count,
                    got=len(items) if isinstance(items, list) else "not_a_list",
                )
                return None
            results = []
            for item_data in items:
                sentiment = SentimentResult(**(item_data.get("sentiment", {})))
                extraction = ContentExtractionResult(
                    **(item_data.get("extraction", {}))
                )
                results.append((sentiment, extraction))
            return results
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.error("batch_parse_failed", error=str(e))
            return None

    async def _process_single(
        self, system_prompt: str, text: str, payload: dict | None
    ) -> tuple[SentimentResult, ContentExtractionResult]:
        """Process a single item — used as fallback when batch parsing fails."""
        payload_str = json.dumps(payload or {}, default=str)[:2000]
        user_content = f"Content text:\n{text}\n\nRaw platform data:\n{payload_str}"
        try:
            response_text = await self._invoke(
                system_prompt, user_content, max_tokens=2048
            )
            data = json.loads(response_text)
            sentiment = SentimentResult(**(data.get("sentiment", {})))
            extraction = ContentExtractionResult(**(data.get("extraction", {})))
            return (sentiment, extraction)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.error("bedrock_parse_failed", error=str(e))
            return (
                SentimentResult(
                    sentiment_score=0.0,
                    sentiment_label="neutral",
                    summary="Analysis failed",
                ),
                ContentExtractionResult(),
            )
        except Exception as e:
            is_throttle = self._is_throttling_error(e)
            logger.error("bedrock_invoke_failed", error=str(e), throttled=is_throttle)
            if is_throttle:
                await asyncio.sleep(30)
            return (
                SentimentResult(
                    sentiment_score=0.0,
                    sentiment_label="neutral",
                    summary="Analysis failed",
                ),
                ContentExtractionResult(),
            )

    async def analyze_and_extract(
        self,
        texts: list[str],
        raw_payloads: list[dict | None],
        topic_keywords: list[dict] | None = None,
    ) -> list[tuple[SentimentResult, ContentExtractionResult]]:
        keyword_context = build_topic_keywords_prompt(topic_keywords)

        # Single-item path (unchanged behavior)
        if len(texts) == 1:
            single_system = (
                ANALYZE_AND_EXTRACT_SYSTEM + keyword_context
                if keyword_context
                else ANALYZE_AND_EXTRACT_SYSTEM
            )
            result = await self._process_single(
                single_system, texts[0], raw_payloads[0]
            )
            return [result]

        # Batch path — chunk items and send each chunk as one API call
        batch_system = (
            ANALYZE_AND_EXTRACT_BATCH_SYSTEM + keyword_context
            if keyword_context
            else ANALYZE_AND_EXTRACT_BATCH_SYSTEM
        )
        single_system = (
            ANALYZE_AND_EXTRACT_SYSTEM + keyword_context
            if keyword_context
            else ANALYZE_AND_EXTRACT_SYSTEM
        )

        all_results: list[tuple[SentimentResult, ContentExtractionResult]] = []

        for chunk_start in range(0, len(texts), BATCH_SIZE):
            chunk_texts = texts[chunk_start : chunk_start + BATCH_SIZE]
            chunk_payloads = raw_payloads[chunk_start : chunk_start + BATCH_SIZE]

            if chunk_start > 0:
                await asyncio.sleep(INTER_REQUEST_DELAY)

            # Try batch call
            try:
                user_content = self._build_batch_user_content(
                    chunk_texts, chunk_payloads
                )
                response_text = await self._invoke(
                    batch_system,
                    user_content,
                    max_tokens=2048 * len(chunk_texts),
                )
                parsed = self._parse_batch_response(response_text, len(chunk_texts))
                if parsed is not None:
                    all_results.extend(parsed)
                    logger.info("batch_success", chunk_size=len(chunk_texts))
                    continue
            except Exception as e:
                is_throttle = self._is_throttling_error(e)
                logger.warning(
                    "batch_invoke_failed",
                    error=str(e),
                    throttled=is_throttle,
                    chunk_size=len(chunk_texts),
                )
                if is_throttle:
                    await asyncio.sleep(30)

            # Fallback: process chunk items individually
            logger.info("batch_fallback_to_individual", chunk_size=len(chunk_texts))
            for j, (text, payload) in enumerate(zip(chunk_texts, chunk_payloads)):
                if j > 0:
                    await asyncio.sleep(INTER_REQUEST_DELAY)
                result = await self._process_single(single_system, text, payload)
                all_results.append(result)

        return all_results
