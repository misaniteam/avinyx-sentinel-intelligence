import asyncio
import json
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from processor import process_voter_list
from routers import voter_list_upload_router

logger = structlog.get_logger()

_sqs_task: asyncio.Task | None = None


async def sqs_consumer_loop():
    """Background task that polls SQS for voter list processing jobs."""
    settings = get_settings()
    sqs = SQSClient()
    logger.info("sqs_consumer_started", queue=settings.sqs_voter_list_queue)

    while True:
        try:
            messages = await sqs.receive_messages(settings.sqs_voter_list_queue)
            for msg in messages:
                try:
                    body = json.loads(msg["Body"])
                    await process_voter_list(body)
                    await sqs.delete_message(settings.sqs_voter_list_queue, msg["ReceiptHandle"])
                except Exception as e:
                    logger.error("message_processing_failed", error=str(e))
        except asyncio.CancelledError:
            logger.info("sqs_consumer_stopping")
            break
        except Exception as e:
            logger.error("polling_error", error=str(e))
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sqs_task
    init_logging("voter-service")
    await start_log_shipper()
    logger.info("voter-service starting")

    # Start background SQS consumer
    _sqs_task = asyncio.create_task(sqs_consumer_loop())

    yield

    # Stop SQS consumer
    if _sqs_task:
        _sqs_task.cancel()
        try:
            await _sqs_task
        except asyncio.CancelledError:
            pass
    logger.info("voter-service shutting down")
    await stop_log_shipper()


app = FastAPI(title="Voter Service", lifespan=lifespan)
app.include_router(voter_list_upload_router, prefix="/voters/voter-list-upload", tags=["voter-list"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "voter-service"}
