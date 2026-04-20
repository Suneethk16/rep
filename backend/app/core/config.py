import json
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,
    )

    app_name: str = "rep-ecommerce-api"
    app_env: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    # Accepts plain URL, comma-separated list, or JSON array — parsed in cors_origins_list
    cors_origins: str = Field(default="")

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    database_url: str
    database_url_sync: str

    # Full Redis URL overrides host/port (required for TLS providers like Upstash).
    # Format: rediss://default:PASSWORD@HOST:6380
    redis_url: str | None = None
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_cache_db: int = 0
    redis_broker_db: int = 1
    redis_result_db: int = 2
    product_cache_ttl_seconds: int = 60

    celery_broker_url: str
    celery_result_backend: str

    first_admin_email: str | None = None
    first_admin_password: str | None = None

    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_currency: str = "inr"

    @property
    def cors_origins_list(self) -> list[str]:
        v = (self.cors_origins or "").strip()
        if not v:
            return []
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except json.JSONDecodeError:
            pass
        return [o.strip() for o in v.split(",") if o.strip()]

    @property
    def redis_cache_url(self) -> str:
        if self.redis_url:
            # Strip any trailing /db suffix from the base URL, then append cache DB index.
            base = self.redis_url.rstrip("/").rsplit("/", 1)[0] if "/" in self.redis_url.split("@")[-1] else self.redis_url
            return f"{base}/{self.redis_cache_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_cache_db}"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
