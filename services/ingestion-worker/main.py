import asyncio
import json
import uuid
import structlog
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.database.session import get_session_factory, tenant_context
from sentinel_shared.models.tenant import Tenant
from sentinel_shared.data.wb_constituencies import WB_CONSTITUENCY_BY_CODE
from sentinel_shared.firebase.client import update_worker_status
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from handlers import get_handler

logger = structlog.get_logger()

async def process_message(message: dict):
    body = json.loads(message["Body"])
    tenant_id = body["tenant_id"]
    platform = body["platform"]
    config = body["config"]
    since = body.get("since")

    tenant_context.set(tenant_id)
    worker_run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Report running status to Firebase
    await update_worker_status(tenant_id, worker_run_id, {
        "worker_run_id": worker_run_id,
        "tenant_id": tenant_id,
        "platform": platform,
        "status": "running",
        "items_fetched": 0,
        "started_at": now,
        "updated_at": now,
    })

    handler = get_handler(platform)
    if not handler:
        logger.error("unknown_platform", platform=platform)
        await update_worker_status(tenant_id, worker_run_id, {
            "status": "failed",
            "error": f"Unknown platform: {platform}",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        return

    try:
        # Look up tenant's constituency for location context
        location_context = None
        factory = get_session_factory()
        async with factory() as session:
            result = await session.execute(
                select(Tenant.constituency_code).where(Tenant.id == tenant_id)
            )
            constituency_code = result.scalar_one_or_none()
            if constituency_code:
                constituency = WB_CONSTITUENCY_BY_CODE.get(constituency_code)
                if constituency:
                    location_context = {
                        "constituency_code": constituency["code"],
                        "constituency_name": constituency["name"],
                        "district": constituency["district"],
                        "keywords": constituency["keywords"],
                        "lat": constituency["lat"],
                        "lng": constituency["lng"],
                    }

        items = await handler.fetch(config, since, location_context=location_context)
        logger.info("fetched_items", platform=platform, count=len(items), tenant_id=tenant_id)

        await update_worker_status(tenant_id, worker_run_id, {
            "items_fetched": len(items),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

        # Set geo data on items that lack it
        if location_context:
            for item in items:
                if not item.geo_lat:
                    item.geo_lat = location_context["lat"]
                if not item.geo_lng:
                    item.geo_lng = location_context["lng"]
                if not item.geo_region:
                    item.geo_region = location_context["constituency_name"]

        # Store items with duplicate handling (skip on conflict)
        saved_items = []
        async with factory() as session:
            for item in items:
                try:
                    async with session.begin_nested():
                        session.add(item)
                    saved_items.append(item)
                except IntegrityError:
                    logger.debug("duplicate_item_skipped", external_id=item.external_id, platform=platform)
            await session.commit()

        logger.info("saved_items", platform=platform, saved=len(saved_items), skipped=len(items) - len(saved_items), tenant_id=tenant_id)

        # Publish saved items to AI pipeline queue
        sqs = SQSClient()
        settings = get_settings()
        item_ids = [str(item.id) for item in saved_items]
        if item_ids:
            await sqs.send_message(settings.sqs_ai_pipeline_queue, {
                "tenant_id": tenant_id,
                "media_item_ids": item_ids,
            })

        await update_worker_status(tenant_id, worker_run_id, {
            "status": "completed",
            "items_fetched": len(saved_items),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error("processing_failed", platform=platform, error=str(e), tenant_id=tenant_id)
        await update_worker_status(tenant_id, worker_run_id, {
            "status": "failed",
            "error": str(e)[:500],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        raise

async def main():
    init_logging("ingestion-worker")
    await start_log_shipper()
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
