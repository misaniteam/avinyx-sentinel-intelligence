import asyncio
import json
import structlog
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.database.session import get_session_factory, tenant_context
from handlers import get_handler

logger = structlog.get_logger()

async def process_message(message: dict):
    body = json.loads(message["Body"])
    tenant_id = body["tenant_id"]
    platform = body["platform"]
    config = body["config"]
    since = body.get("since")

    tenant_context.set(tenant_id)

    handler = get_handler(platform)
    if not handler:
        logger.error("unknown_platform", platform=platform)
        return

    try:
        items = await handler.fetch(config, since)
        logger.info("fetched_items", platform=platform, count=len(items), tenant_id=tenant_id)

        # Store items and publish to AI pipeline
        factory = get_session_factory()
        async with factory() as session:
            for item in items:
                session.add(item)
            await session.commit()

        # Publish to AI pipeline queue
        sqs = SQSClient()
        settings = get_settings()
        item_ids = [str(item.id) for item in items]
        if item_ids:
            await sqs.send_message(settings.sqs_ai_pipeline_queue, {
                "tenant_id": tenant_id,
                "media_item_ids": item_ids,
            })
    except Exception as e:
        logger.error("processing_failed", platform=platform, error=str(e), tenant_id=tenant_id)
        raise

async def main():
    logger.info("ingestion-worker starting")
    settings = get_settings()
    sqs = SQSClient()

    while True:
        try:
            messages = await sqs.receive_messages(settings.sqs_ingestion_queue)
            for msg in messages:
                try:
                    await process_message(msg)
                    await sqs.delete_message(settings.sqs_ingestion_queue, msg["ReceiptHandle"])
                except Exception as e:
                    logger.error("message_processing_failed", error=str(e))
        except Exception as e:
            logger.error("polling_error", error=str(e))
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
