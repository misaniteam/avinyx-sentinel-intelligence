import asyncio
import json
import structlog

from sentinel_shared.messaging.sqs import SQSClient
from sentinel_shared.config import get_settings
from sentinel_shared.logging import init_logging

from processor import process_voter_list

logger = structlog.get_logger()

VISIBILITY_TIMEOUT = 600


async def main():
    init_logging("voter-worker")

    sqs = SQSClient()
    settings = get_settings()

    while True:
        try:
            messages = await sqs.receive_messages(
                settings.sqs_voter_list_queue,
                max_messages=1,
                wait_time=20,
                visibility_timeout=VISIBILITY_TIMEOUT,
            )

            for msg in messages:
                try:
                    body = json.loads(msg["Body"])

                    await process_voter_list(body)

                    await sqs.delete_message(
                        settings.sqs_voter_list_queue, msg["ReceiptHandle"]
                    )

                except Exception as e:
                    logger.error("msg_failed", error=str(e))

        except Exception as e:
            logger.error("poll_error", error=str(e))
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
