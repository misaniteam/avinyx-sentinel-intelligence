from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"
    database_url_sync: str = "postgresql://sentinel:sentinel@localhost:5432/sentinel"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # AWS
    aws_region: str = "us-east-1"
    aws_endpoint_url: str | None = None
    sqs_ingestion_queue: str = "sentinel-ingestion-jobs"
    sqs_ai_pipeline_queue: str = "sentinel-ai-pipeline"
    sqs_notifications_queue: str = "sentinel-notifications"
    sns_tenant_events_topic: str = "sentinel-tenant-events"
    s3_reports_bucket: str = "sentinel-reports"

    # Firebase
    firebase_project_id: str = ""
    firebase_credentials_path: str = ""

    # AI
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    aws_bedrock_region: str = "us-east-1"

    # Service URLs
    auth_service_url: str = "http://auth-service:8001"
    tenant_service_url: str = "http://tenant-service:8002"
    ingestion_service_url: str = "http://ingestion-service:8003"
    analytics_service_url: str = "http://analytics-service:8005"
    campaign_service_url: str = "http://campaign-service:8006"
    notification_service_url: str = "http://notification-service:8007"

    # Redis
    redis_url: str = "redis://localhost:6379"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
