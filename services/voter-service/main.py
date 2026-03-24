import asyncio
import json
import structlog
from sentinel_shared.config import get_settings
from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from processor import process_voter_list

logger = structlog.get_logger()


async def main():
    init_logging("voter-service")
    await start_log_shipper()
    logger.info("voter-service starting")
    settings = get_settings()
    sqs = SQSClient()

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
        except Exception as e:
            logger.error("polling_error", error=str(e))
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
