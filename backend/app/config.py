import os
import secrets
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "FinsurgeENRIMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Database — SQLite for dev, PostgreSQL for production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db")

    # Auth — MUST be set via env var in production
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_hex(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "1440"))

    # CORS — set via env var in production (comma-separated)
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

    # Password policy
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True
    PASSWORD_MAX_AGE_DAYS: int = 90

    # Rate limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_API: str = "100/minute"

    # Session
    MAX_CONCURRENT_SESSIONS: int = 3

    # Thresholds
    CTR_THRESHOLD_PAISE: int = 1000000_00  # INR 10,00,000
    SLA_CRITICAL_HOURS: int = 4
    SLA_HIGH_HOURS: int = 24
    SLA_MEDIUM_HOURS: int = 72
    SLA_LOW_HOURS: int = 168

    # PII encryption key — MUST be 32 bytes hex in production
    PII_ENCRYPTION_KEY: str = os.getenv("PII_ENCRYPTION_KEY", secrets.token_hex(32))

    class Config:
        env_file = ".env"


settings = Settings()
