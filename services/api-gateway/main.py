import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from middleware.rate_limiter import RateLimiterMiddleware
from proxy import router as proxy_router

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("api-gateway starting")
    yield
    logger.info("api-gateway shutting down")

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

# Proxy routes
app.include_router(proxy_router)

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "api-gateway"}
