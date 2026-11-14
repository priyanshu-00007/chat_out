from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized backend configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "ChatSphere API"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # PostgreSQL (Supabase hosted PostgreSQL)
    DATABASE_URL: str = ""

    # JWT
    JWT_SECRET_KEY: str = "dev-insecure-change-me-before-production-32chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # Authentication security
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # Compatibility no-op OTP settings retained for older config references
    DEV_OTP_MODE: bool = False
    OTP_EXPIRE_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5
    SMS_PROVIDER: Literal["dev"] = "dev"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Optional email recovery configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""

    # Supabase-specific configuration
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Storage
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    LOCAL_UPLOAD_DIR: str = "storage_uploads"
    MAX_UPLOAD_SIZE_MB: int = 25

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if not value:
            return ""
        trimmed = value.strip()
        if trimmed.startswith("postgres://"):
            return trimmed.replace("postgres://", "postgresql+psycopg://", 1)
        if trimmed.startswith("postgresql://"):
            return trimmed.replace("postgresql://", "postgresql+psycopg://", 1)
        return trimmed

    @model_validator(mode="after")
    def enforce_production_safety(self) -> "Settings":
        if self.ENVIRONMENT == "production" and self.DEV_OTP_MODE:
            self.DEV_OTP_MODE = False
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_database_configured(self) -> bool:
        return bool(self.DATABASE_URL)


@lru_cache
def get_settings() -> Settings:
    return Settings()
