from handlers.base import BaseConnectorHandler
from handlers.brand24 import Brand24Handler
from handlers.youtube import YouTubeHandler
from handlers.twitter import TwitterHandler
from handlers.news_rss import NewsRSSHandler
from handlers.news_api import NewsAPIHandler
from handlers.reddit import RedditHandler
from handlers.file_upload_handler import FileUploadHandler
from handlers.facebook_import_handler import FacebookImportHandler

_registry: dict[str, BaseConnectorHandler] = {
    "brand24": Brand24Handler(),
    "youtube": YouTubeHandler(),
    "twitter": TwitterHandler(),
    "news_rss": NewsRSSHandler(),
    "news_api": NewsAPIHandler(),
    "reddit": RedditHandler(),
    "file_upload": FileUploadHandler(),
    "facebook_import": FacebookImportHandler(),
}


def get_handler(platform: str) -> BaseConnectorHandler | None:
    return _registry.get(platform)
