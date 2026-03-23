import asyncio
import json
import structlog
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.media import RawMediaItem, SentimentAnalysis, SentimentAggregate
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.ai.factory import AIProviderFactory
from sentinel_shared.ai.claude_provider import ClaudeProvider
from sentinel_shared.ai.openai_provider import OpenAIProvider
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from sqlalchemy import select

logger = structlog.get_logger()

# Register providers
AIProviderFactory.register("claude", ClaudeProvider)
AIProviderFactory.register("openai", OpenAIProvider)

async def process_message(message: dict):
    body = json.loads(message["Body"])
    tenant_id = body["tenant_id"]
    media_item_ids = body["media_item_ids"]

    tenant_context.set(tenant_id)
    factory = get_session_factory()

    async with factory() as session:
        # Get tenant settings for AI provider
        tenant_result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            logger.error("tenant_not_found", tenant_id=tenant_id)
            return

        ai_provider_name = (tenant.settings or {}).get("ai_provider", "claude")
        ai_config = (tenant.settings or {}).get("ai_config", {})

        provider = AIProviderFactory.get_provider(ai_provider_name, ai_config)

        # Load media items
        items_result = await session.execute(
            select(RawMediaItem).where(RawMediaItem.id.in_(media_item_ids))
        )
        items = items_result.scalars().all()

        if not items:
            return

        texts = [item.content or "" for item in items]
        results = await provider.analyze_sentiment(texts)

        for item, result in zip(items, results):
            analysis = SentimentAnalysis(
                tenant_id=tenant_id,
                media_item_id=item.id,
                ai_provider=ai_provider_name,
                sentiment_score=result.sentiment_score,
                sentiment_label=result.sentiment_label,
                topics=result.topics,
                entities=[e if isinstance(e, dict) else {"name": str(e)} for e in result.entities],
                summary=result.summary,
            )
            session.add(analysis)

        await session.commit()
        logger.info("analysis_complete", tenant_id=tenant_id, items=len(items))

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
                    logger.error("message_processing_failed", error=str(e))
        except Exception as e:
            logger.error("polling_error", error=str(e))
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
