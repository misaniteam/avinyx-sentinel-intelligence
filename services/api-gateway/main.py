import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
from middleware.rate_limiter import RateLimiterMiddleware
from infrastructure import router as infrastructure_router
from proxy import router as proxy_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_logging("api-gateway")
    await start_log_shipper()
    logger.info("api-gateway starting")
    yield
    logger.info("api-gateway shutting down")
    await stop_log_shipper()


app = FastAPI(title="Sentinel API Gateway", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.add_middleware(RateLimiterMiddleware)

# Infrastructure status (must be before proxy to avoid catch-all)
app.include_router(infrastructure_router)

# Proxy routes
app.include_router(proxy_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "api-gateway"}
