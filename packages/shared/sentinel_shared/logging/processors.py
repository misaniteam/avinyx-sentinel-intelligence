import asyncio
from datetime import datetime, timezone

import sentry_sdk


class SentryProcessor:
    """Structlog processor that forwards ERROR/CRITICAL events to Sentry."""

    def __call__(self, logger, method_name: str, event_dict: dict) -> dict:
        level = event_dict.get("level", method_name)
        if level in ("error", "critical"):
            sentry_sdk.set_tag("service", event_dict.get("service", "unknown"))
            tenant_id = event_dict.get("tenant_id")
            if tenant_id:
                sentry_sdk.set_tag("tenant_id", str(tenant_id))

            extras = {
                k: v
                for k, v in event_dict.items()
                if k
                not in ("event", "level", "timestamp", "_record", "_from_structlog")
            }
            sentry_sdk.capture_event(
                {
                    "message": event_dict.get("event", ""),
                    "level": level,
                    "extra": extras,
                }
            )

        return event_dict


class LogShipperProcessor:
    """Structlog processor that enqueues log entries for async HTTP shipping."""

    def __init__(self, queue: asyncio.Queue | None = None, service_name: str = ""):
        self._queue = queue
        self._service_name = service_name

    def set_queue(self, queue: asyncio.Queue) -> None:
        self._queue = queue

    def __call__(self, logger, method_name: str, event_dict: dict) -> dict:
        if self._queue is None:
            return event_dict

        # Prevent infinite loop: don't ship logging-service's own logs
        if self._service_name == "logging-service":
            return event_dict

        entry = {
            "service": event_dict.get("service", self._service_name),
            "level": (event_dict.get("level", method_name) or method_name).upper(),
            "message": event_dict.get("event", ""),
            "tenant_id": event_dict.get("tenant_id"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": {
                k: _serialize_value(v)
                for k, v in event_dict.items()
                if k
                not in (
                    "event",
                    "level",
                    "timestamp",
                    "service",
                    "tenant_id",
                    "_record",
                    "_from_structlog",
                )
            },
            "trace_id": event_dict.get("trace_id"),
        }

        try:
            self._queue.put_nowait(entry)
        except asyncio.QueueFull:
            pass  # Drop log entry silently to avoid backpressure

        return event_dict


def _serialize_value(v):
    """Ensure values are JSON-serializable."""
    if isinstance(v, (str, int, float, bool, type(None))):
        return v
    return str(v)
