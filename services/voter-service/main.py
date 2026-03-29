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

    # Pre-load Surya OCR models at startup (avoids first-message latency)
    surya_engine = None
    if settings.ocr_engine == "surya":
        try:
            from ocr_engine import SuryaOCREngine

            surya_engine = SuryaOCREngine()
            logger.info("surya_ready", device=surya_engine.device)
        except Exception as e:
            logger.warning(
                "surya_init_failed",
                error=str(e),
                fallback="bedrock_vision",
            )

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

                    await process_voter_list(body, surya_engine=surya_engine)

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
