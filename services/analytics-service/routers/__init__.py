from routers.dashboard import router as dashboard_router
from routers.heatmap import router as heatmap_router
from routers.reports import router as reports_router
from routers.platforms import router as platforms_router
from routers.topics import router as topics_router

__all__ = [
    "dashboard_router",
    "heatmap_router",
    "reports_router",
    "platforms_router",
    "topics_router",
]
