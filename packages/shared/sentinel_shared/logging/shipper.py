import asyncio
import httpx
from sentinel_shared.config import get_settings

_queue: asyncio.Queue | None = None
_task: asyncio.Task | None = None
_client: httpx.AsyncClient | None = None


async def start_log_shipper() -> None:
    """Start the background log shipping task."""
    global _queue, _task, _client

    settings = get_settings()
    if not settings.log_shipping_enabled:
        return

    _queue = asyncio.Queue(maxsize=10000)
    _client = httpx.AsyncClient(
        base_url=settings.logging_service_url,
        timeout=5.0,
    )
    _task = asyncio.create_task(_ship_loop())

    # Make queue available to the processor
    from sentinel_shared.logging.setup import _shipper_processor
    if _shipper_processor is not None:
        _shipper_processor.set_queue(_queue)


async def stop_log_shipper() -> None:
    """Stop the background log shipping task and flush remaining entries."""
    global _task, _client, _queue

    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None

    # Flush remaining entries
    if _queue is not None and _client is not None:
        await _flush_batch()

    if _client is not None:
        await _client.aclose()
        _client = None

    _queue = None


async def _ship_loop() -> None:
    """Background loop that batches and ships log entries."""
    while True:
        try:
            await asyncio.sleep(2)
            await _flush_batch()
        except asyncio.CancelledError:
            break
        except Exception:
            pass  # Silently continue on shipping failures


async def _flush_batch() -> None:
    """Drain the queue and POST a batch to the logging service."""
    if _queue is None or _client is None:
        return

    batch = []
    while not _queue.empty() and len(batch) < 50:
        try:
            entry = _queue.get_nowait()
            batch.append(entry)
        except asyncio.QueueEmpty:
            break

    if not batch:
        return

    try:
        await _client.post("/logs/ingest", json={"entries": batch})
    except Exception:
        pass  # Fire-and-forget: silently drop on failure


def get_queue() -> asyncio.Queue | None:
    return _queue
