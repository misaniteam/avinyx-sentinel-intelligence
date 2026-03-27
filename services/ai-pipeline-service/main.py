import asyncio
import json
import uuid
import traceback
import structlog
from datetime import datetime, timezone
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.media import RawMediaItem, SentimentAnalysis, SentimentAggregate, MediaFeed
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.models.topic_keyword import TopicKeyword
from sentinel_shared.ai.factory import AIProviderFactory
from sentinel_shared.ai.claude_provider import ClaudeProvider
from sentinel_shared.ai.openai_provider import OpenAIProvider
from sentinel_shared.ai.bedrock_provider import BedrockProvider
from sentinel_shared.firebase.client import update_worker_status
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from sqlalchemy import select, update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = structlog.get_logger()

# Register providers
AIProviderFactory.register("claude", ClaudeProvider)
AIProviderFactory.register("openai", OpenAIProvider)
AIProviderFactory.register("bedrock", BedrockProvider)

INTER_ITEM_DELAY = 5  # seconds between individual API calls to avoid Bedrock throttling


async def process_single_item(factory, provider, ai_provider_name, tenant_id, topic_keywords, item):
    """Process a single item through the AI provider."""
    async with factory() as session:
        # Mark item as processing
        await session.execute(
            sa_update(RawMediaItem)
            .where(RawMediaItem.id == item.id)
            .values(ai_status="processing")
        )
        await session.commit()

    async with factory() as session:
        try:
            results = await provider.analyze_and_extract(
                [item.content or ""],
                [item.raw_payload],
                topic_keywords=topic_keywords or None,
            )
            sentiment, extraction = results[0]
        except Exception as e:
            logger.error("ai_item_failed", tenant_id=tenant_id, item_id=str(item.id), error=str(e))
            await session.execute(
                sa_update(RawMediaItem)
                .where(RawMediaItem.id == item.id)
                .values(ai_status="failed")
            )
            await session.commit()
            return False

        entities = [e if isinstance(e, dict) else {"name": str(e)} for e in sentiment.entities]

        # Create SentimentAnalysis
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

        # Upsert MediaFeed record
        feed_values = dict(
            tenant_id=tenant_id,
            media_item_id=item.id,
            platform=item.platform,
            author=item.author,
            published_at=item.published_at,
            engagement=item.engagement or {},
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

        # Mark item as completed
        await session.execute(
            sa_update(RawMediaItem)
            .where(RawMediaItem.id == item.id)
            .values(ai_status="completed")
        )
        await session.commit()
        return True


async def process_message(message: dict):
    body = json.loads(message["Body"])
    tenant_id = body["tenant_id"]

    tenant_context.set(tenant_id)
    factory = get_session_factory()
    worker_run_id = f"ai-{uuid.uuid4()}"
    now = datetime.now(timezone.utc).isoformat()

    await update_worker_status(tenant_id, worker_run_id, {
        "worker_run_id": worker_run_id,
        "tenant_id": tenant_id,
        "platform": "ai-pipeline",
        "status": "running",
        "items_fetched": 0,
        "started_at": now,
        "updated_at": now,
    })

    async with factory() as session:
        # Get tenant settings for AI provider
        tenant_result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            logger.error("tenant_not_found", tenant_id=tenant_id)
            await update_worker_status(tenant_id, worker_run_id, {
                "status": "failed",
                "error": "Tenant not found",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            return

        ai_provider_name = (tenant.settings or {}).get("ai_provider", "bedrock")
        ai_config = (tenant.settings or {}).get("ai_config", {})

        provider = AIProviderFactory.get_provider(ai_provider_name, ai_config)

        # Fetch tenant's active topic keywords for sentiment guidance
        tk_result = await session.execute(
            select(TopicKeyword).where(
                TopicKeyword.tenant_id == tenant_id,
                TopicKeyword.is_active == True,
            )
        )
        topic_keywords = [
            {"name": tk.name, "keywords": tk.keywords, "sentiment_direction": tk.sentiment_direction}
            for tk in tk_result.scalars().all()
        ]

    # Process items one by one
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
                    .limit(1)
                )
                item = result.scalar_one_or_none()

            if not item:
                break

            # Delay before each API call (skip first)
            if total_processed + total_failed > 0:
                await asyncio.sleep(INTER_ITEM_DELAY)

            success = await process_single_item(
                factory, provider, ai_provider_name, tenant_id, topic_keywords, item,
            )

            if success:
                total_processed += 1
                logger.info("item_complete", tenant_id=tenant_id, item_id=str(item.id), progress=total_processed)
            else:
                total_failed += 1

            # Update worker status periodically
            if (total_processed + total_failed) % 5 == 0 or not success:
                await update_worker_status(tenant_id, worker_run_id, {
                    "items_fetched": total_processed,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })

    except Exception as e:
        await update_worker_status(tenant_id, worker_run_id, {
            "status": "failed",
            "error": str(e)[:500],
            "items_fetched": total_processed,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        raise

    if total_processed == 0 and total_failed == 0:
        logger.debug("no_pending_items", tenant_id=tenant_id)
    else:
        logger.info("analysis_complete", tenant_id=tenant_id, processed=total_processed, failed=total_failed)

    await update_worker_status(tenant_id, worker_run_id, {
        "status": "completed",
        "items_fetched": total_processed,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })


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
                    await sqs.delete_message(settings.sqs_ai_pipeline_queue, msg["ReceiptHandle"])
                except Exception as e:
                    logger.error("message_processing_failed", error=str(e), traceback=traceback.format_exc())
        except Exception as e:
            logger.error("polling_error", error=str(e))
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
