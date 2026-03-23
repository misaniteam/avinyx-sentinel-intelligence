import logging

import structlog
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from sentinel_shared.config import get_settings
from sentinel_shared.logging.processors import SentryProcessor, LogShipperProcessor

_shipper_processor: LogShipperProcessor | None = None


def init_logging(service_name: str) -> None:
    """Initialize structured logging with optional Sentry integration.

    Call this at service startup before any logging occurs.
    """
    global _shipper_processor

    settings = get_settings()

    # Initialize Sentry if DSN is configured (graceful skip otherwise)
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.sentry_environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(
                    level=logging.ERROR,
                    event_level=logging.ERROR,
                ),
            ],
            release=f"sentinel-{service_name}@0.1.0",
        )

    # Create processors
    sentry_processor = SentryProcessor()
    _shipper_processor = LogShipperProcessor(service_name=service_name)

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            sentry_processor,
            _shipper_processor,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Bind service name to all loggers
    structlog.contextvars.bind_contextvars(service=service_name)

    logger = structlog.get_logger()
    if settings.sentry_dsn:
        logger.info("sentry_initialized", dsn_configured=True)
    else:
        logger.info("sentry_disabled", reason="no DSN configured")
