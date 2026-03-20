import httpx
import structlog
from fastapi import APIRouter, Request, Response, Depends
from fastapi.responses import JSONResponse
from sentinel_shared.config import get_settings
from sentinel_shared.auth.dependencies import get_current_user
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = structlog.get_logger()
router = APIRouter()

# Route prefix -> service URL mapping
def get_service_map() -> dict[str, str]:
    settings = get_settings()
    return {
        "/api/auth": settings.auth_service_url,
        "/api/tenants": settings.tenant_service_url,
        "/api/ingestion": settings.ingestion_service_url,
        "/api/analytics": settings.analytics_service_url,
        "/api/campaigns": settings.campaign_service_url,
        "/api/notifications": settings.notification_service_url,
    }

# Public routes that don't require auth
PUBLIC_PATHS = {
    "/api/auth/login",
    "/api/auth/setup",
    "/api/auth/setup-status",
    "/api/auth/refresh",
}

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
    retry=retry_if_exception_type(httpx.ConnectError),
)
async def proxy_request(method: str, url: str, headers: dict, content: bytes, params: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await client.request(
            method=method,
            url=url,
            headers=headers,
            content=content,
            params=params,
        )

@router.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def gateway_proxy(request: Request, path: str):
    full_path = f"/api/{path}"

    # Auth check for non-public routes
    if full_path not in PUBLIC_PATHS:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return JSONResponse(status_code=401, content={"detail": "Missing authorization header"})

    # Find target service
    service_map = get_service_map()
    target_url = None
    strip_prefix = ""

    for prefix, service_url in service_map.items():
        if full_path.startswith(prefix):
            # Map /api/auth/login -> auth-service /auth/login
            remaining = full_path[len(prefix):]
            service_prefix = prefix.replace("/api", "")
            target_url = f"{service_url}{service_prefix}{remaining}"
            break

    if not target_url:
        return JSONResponse(status_code=404, content={"detail": "Service not found"})

    # Forward headers
    headers = dict(request.headers)
    headers.pop("host", None)

    # Read body
    body = await request.body()

    try:
        response = await proxy_request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            params=dict(request.query_params),
        )

        # Forward response
        excluded_headers = {"content-encoding", "transfer-encoding", "content-length"}
        response_headers = {k: v for k, v in response.headers.items() if k.lower() not in excluded_headers}

        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type"),
        )
    except httpx.ConnectError:
        logger.error("service_unavailable", target=target_url)
        return JSONResponse(status_code=503, content={"detail": "Service temporarily unavailable"})
    except Exception as e:
        logger.error("proxy_error", error=str(e), target=target_url)
        return JSONResponse(status_code=502, content={"detail": "Bad gateway"})
