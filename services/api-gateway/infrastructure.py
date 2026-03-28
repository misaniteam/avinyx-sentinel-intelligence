import asyncio
import time
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import APIRouter, Depends

from sentinel_shared.auth.dependencies import require_super_admin
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient

logger = structlog.get_logger()
router = APIRouter()

SERVICE_NAMES = {
    "auth-service": "auth_service_url",
    "tenant-service": "tenant_service_url",
    "ingestion-service": "ingestion_service_url",
    "analytics-service": "analytics_service_url",
    "campaign-service": "campaign_service_url",
    "notification-service": "notification_service_url",
    "logging-service": "logging_service_url",
}

QUEUE_DLQ_MAP = {
    "sentinel-ingestion-jobs": "sentinel-ingestion-jobs-dlq",
    "sentinel-ai-pipeline": "sentinel-ai-pipeline-dlq",
    "sentinel-notifications": None,  # No DLQ for notifications queue
}


async def _check_service_health(service_name: str, service_url: str) -> dict:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{service_url}/health")
            elapsed = round((time.monotonic() - start) * 1000)
            if resp.status_code == 200:
                return {"status": "healthy", "response_time_ms": elapsed}
            return {"status": "unhealthy", "response_time_ms": elapsed}
    except Exception:
        return {"status": "unreachable", "response_time_ms": None}


async def _get_queue_metrics(
    sqs: SQSClient, queue_name: str, dlq_name: str | None
) -> dict:
    result = {"messages": 0, "not_visible": 0, "dlq_messages": None}
    try:
        attrs = await sqs.get_queue_attributes(queue_name)
        result["messages"] = int(attrs.get("ApproximateNumberOfMessages", 0))
        result["not_visible"] = int(
            attrs.get("ApproximateNumberOfMessagesNotVisible", 0)
        )
    except Exception:
        pass

    if dlq_name:
        try:
            dlq_attrs = await sqs.get_queue_attributes(dlq_name)
            result["dlq_messages"] = int(
                dlq_attrs.get("ApproximateNumberOfMessages", 0)
            )
        except Exception:
            result["dlq_messages"] = None

    return result


@router.get("/api/infrastructure/status")
async def infrastructure_status(user: dict = Depends(require_super_admin)):
    settings = get_settings()
    sqs = SQSClient()

    # Build tasks for concurrent execution
    service_tasks = {}
    for name, url_attr in SERVICE_NAMES.items():
        url = getattr(settings, url_attr)
        service_tasks[name] = _check_service_health(name, url)

    queue_tasks = {}
    for queue_name, dlq_name in QUEUE_DLQ_MAP.items():
        queue_tasks[queue_name] = _get_queue_metrics(sqs, queue_name, dlq_name)

    # Run all health checks and queue metrics concurrently
    all_keys = list(service_tasks.keys()) + list(queue_tasks.keys())
    all_coros = list(service_tasks.values()) + list(queue_tasks.values())
    results = await asyncio.gather(*all_coros, return_exceptions=True)

    # Parse results
    services = {"api-gateway": {"status": "healthy", "response_time_ms": 0}}
    queues = {}

    for key, result in zip(all_keys, results):
        if key in service_tasks:
            if isinstance(result, Exception):
                services[key] = {"status": "unreachable", "response_time_ms": None}
            else:
                services[key] = result
        else:
            if isinstance(result, Exception):
                queues[key] = {"messages": 0, "not_visible": 0, "dlq_messages": None}
            else:
                queues[key] = result

    return {
        "services": services,
        "queues": queues,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
