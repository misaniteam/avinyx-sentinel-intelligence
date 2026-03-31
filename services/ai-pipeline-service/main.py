import asyncio
import json
import uuid
import traceback
import structlog
from datetime import datetime, timezone
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.media import (
    RawMediaItem,
    SentimentAnalysis,
    MediaFeed,
)
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.models.topic_keyword import TopicKeyword
from sentinel_shared.ai.factory import AIProviderFactory
from sentinel_shared.ai.claude_provider import ClaudeProvider
from sentinel_shared.ai.openai_provider import OpenAIProvider
from sentinel_shared.ai.bedrock_provider import BedrockProvider
from sentinel_shared.firebase.client import update_worker_status
from sentinel_shared.logging import init_logging, start_log_shipper
from sqlalchemy import select, update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = structlog.get_logger()

# Register providers
AIProviderFactory.register("claude", ClaudeProvider)
AIProviderFactory.register("openai", OpenAIProvider)
AIProviderFactory.register("bedrock", BedrockProvider)

BATCH_SIZE = 5  # items to fetch and process per batch
INTER_BATCH_DELAY = 5  # seconds between batch API calls


async def process_batch(
    factory, provider, ai_provider_name, tenant_id, topic_keywords, items
):
    """Process a batch of items through the AI provider in a single call."""
    item_ids = [item.id for item in items]

    # Mark all items as processing
    async with factory() as session:
        await session.execute(
            sa_update(RawMediaItem)
            .where(RawMediaItem.id.in_(item_ids))
            .values(ai_status="processing")
        )
        await session.commit()

    # Call provider with the full batch
    texts = [item.content or "" for item in items]
    payloads = [item.raw_payload for item in items]

    try:
        results = await provider.analyze_and_extract(
            texts, payloads, topic_keywords=topic_keywords or None
        )
    except Exception as e:
        logger.error(
            "ai_batch_failed",
            tenant_id=tenant_id,
            batch_size=len(items),
            error=str(e),
        )
        # Mark all items as failed
        async with factory() as session:
            await session.execute(
                sa_update(RawMediaItem)
                .where(RawMediaItem.id.in_(item_ids))
                .values(ai_status="failed")
            )
            await session.commit()
        return 0, len(items)

    # Save results per item
    success_count = 0
    fail_count = 0

    async with factory() as session:
        for item, (sentiment, extraction) in zip(items, results):
            is_failure = (
                sentiment.sentiment_score == 0.0
                and sentiment.sentiment_label == "neutral"
                and sentiment.summary == "Analysis failed"
            )

            if is_failure:
                await session.execute(
                    sa_update(RawMediaItem)
                    .where(RawMediaItem.id == item.id)
                    .values(ai_status="failed")
                )
                fail_count += 1
                continue

            entities = [
                e if isinstance(e, dict) else {"name": str(e)}
                for e in sentiment.entities
            ]

            analysis = SentimentAnalysis(
                tenant_id=tenant_id,
                media_item_id=item.id,
                ai_provider=ai_provider_name,
                sentiment_score=sentiment.sentiment_score,
                sentiment_label=sentiment.sentiment_label,
                topics=sentiment.topics,
                entities=entities,
                summary=sentiment.summary,
            )
            session.add(analysis)

            # Merge comment sentiment into engagement JSONB if present
            feed_engagement = dict(item.engagement or {})
            if sentiment.comment_sentiment:
                feed_engagement["comment_sentiment"] = {
                    "sentiment_score": sentiment.comment_sentiment.sentiment_score,
                    "sentiment_label": sentiment.comment_sentiment.sentiment_label,
                    "summary": sentiment.comment_sentiment.summary,
                }

            feed_values = dict(
                tenant_id=tenant_id,
                media_item_id=item.id,
                platform=item.platform,
                author=item.author,
                published_at=item.published_at,
                engagement=feed_engagement,
                title=extraction.title or None,
                description=extraction.description or None,
                image_url=extraction.image_url or None,
                source_link=extraction.source_link or item.url,
                external_links=extraction.external_links,
                sentiment_score=sentiment.sentiment_score,
                sentiment_label=sentiment.sentiment_label,
                ai_provider=ai_provider_name,
                topics=sentiment.topics,
                entities=entities,
                summary=sentiment.summary,
            )
            stmt = pg_insert(MediaFeed).values(**feed_values)
            update_keys = [k for k in feed_values if k != "media_item_id"]
            stmt = stmt.on_conflict_do_update(
                index_elements=["media_item_id"],
                set_={k: stmt.excluded[k] for k in update_keys},
            )
            await session.execute(stmt)

            await session.execute(
                sa_update(RawMediaItem)
                .where(RawMediaItem.id == item.id)
                .values(ai_status="completed")
            )
            success_count += 1

        await session.commit()

    return success_count, fail_count


async def process_message(message: dict):
    body = json.loads(message["Body"])
    tenant_id = body["tenant_id"]

    tenant_context.set(tenant_id)
    factory = get_session_factory()
    worker_run_id = f"ai-{uuid.uuid4()}"
    now = datetime.now(timezone.utc).isoformat()

    await update_worker_status(
        tenant_id,
        worker_run_id,
        {
            "worker_run_id": worker_run_id,
            "tenant_id": tenant_id,
            "platform": "ai-pipeline",
            "status": "running",
            "items_fetched": 0,
            "started_at": now,
            "updated_at": now,
        },
    )

    async with factory() as session:
        # Get tenant settings for AI provider
        tenant_result = await session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            logger.error("tenant_not_found", tenant_id=tenant_id)
            await update_worker_status(
                tenant_id,
                worker_run_id,
                {
                    "status": "failed",
                    "error": "Tenant not found",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            return

        ai_provider_name = (tenant.settings or {}).get("ai_provider", "bedrock")
        ai_config = (tenant.settings or {}).get("ai_config", {})

        provider = AIProviderFactory.get_provider(ai_provider_name, ai_config)

        # Fetch tenant's active topic keywords for sentiment guidance
        tk_result = await session.execute(
            select(TopicKeyword).where(
                TopicKeyword.tenant_id == tenant_id,
                TopicKeyword.is_active.is_(True),
            )
        )
        topic_keywords = [
            {
                "name": tk.name,
                "keywords": tk.keywords,
                "sentiment_direction": tk.sentiment_direction,
            }
            for tk in tk_result.scalars().all()
        ]

    # Process items in batches
    total_processed = 0
    total_failed = 0
    try:
        while True:
            async with factory() as session:
                result = await session.execute(
                    select(RawMediaItem)
                    .where(
                        RawMediaItem.tenant_id == tenant_id,
                        RawMediaItem.ai_status == "pending",
                    )
                    .order_by(RawMediaItem.created_at)
                    .limit(BATCH_SIZE)
                )
                items = result.scalars().all()

            if not items:
                break

            # Delay before each batch call (skip first)
            if total_processed + total_failed > 0:
                await asyncio.sleep(INTER_BATCH_DELAY)

            batch_success, batch_fail = await process_batch(
                factory,
                provider,
                ai_provider_name,
                tenant_id,
                topic_keywords,
                items,
            )

            total_processed += batch_success
            total_failed += batch_fail

            logger.info(
                "batch_complete",
                tenant_id=tenant_id,
                batch_size=len(items),
                batch_success=batch_success,
                batch_fail=batch_fail,
                total_progress=total_processed,
            )

            await update_worker_status(
                tenant_id,
                worker_run_id,
                {
                    "items_fetched": total_processed,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )

    except Exception as e:
        await update_worker_status(
            tenant_id,
            worker_run_id,
            {
                "status": "failed",
                "error": str(e)[:500],
                "items_fetched": total_processed,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        raise

    if total_processed == 0 and total_failed == 0:
        logger.debug("no_pending_items", tenant_id=tenant_id)
    else:
        logger.info(
            "analysis_complete",
            tenant_id=tenant_id,
            processed=total_processed,
            failed=total_failed,
        )

    await update_worker_status(
        tenant_id,
        worker_run_id,
        {
            "status": "completed",
            "items_fetched": total_processed,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )


async def main():
    init_logging("ai-pipeline-service")
    await start_log_shipper()
    logger.info("ai-pipeline-service starting")
    settings = get_settings()
    sqs = SQSClient()

    while True:
        try:
            messages = await sqs.receive_messages(settings.sqs_ai_pipeline_queue)
            for msg in messages:
                try:
                    await process_message(msg)
                    await sqs.delete_message(
                        settings.sqs_ai_pipeline_queue, msg["ReceiptHandle"]
                    )
                except Exception as e:
                    logger.error(
                        "message_processing_failed",
                        error=str(e),
                        traceback=traceback.format_exc(),
                    )
        except Exception as e:
            logger.error("polling_error", error=str(e))
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
