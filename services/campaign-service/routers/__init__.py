from routers.campaigns import router as campaigns_router
from routers.voters import router as voters_router
from routers.media_feeds import router as media_feeds_router
from routers.topic_keywords import router as topic_keywords_router

__all__ = [
    "campaigns_router",
    "voters_router",
    "media_feeds_router",
    "topic_keywords_router",
]
