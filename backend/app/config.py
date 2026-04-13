import os
import secrets
import json
import logging
from pydantic import field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger("finsurge.config")


def _load_aws_secrets() -> dict:
    """Load secrets from AWS Secrets Manager if running in AWS."""
    secret_arn = os.getenv("AWS_SECRET_ARN")
    if not secret_arn:
        return {}
    try:
        import boto3
        region = os.getenv("AWS_REGION", "ap-south-1")
        client = boto3.client("secretsmanager", region_name=region)
        resp = client.get_secret_value(SecretId=secret_arn)
        return json.loads(resp["SecretString"])
    except Exception as e:
        logger.warning(f"Could not load AWS secrets: {e}")
        return {}


_aws_secrets = _load_aws_secrets()


class Settings(BaseSettings):
    APP_NAME: str = "FinsurgeFRIMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database — SQLite for dev, PostgreSQL (RDS/Render) for production
    DATABASE_URL: str = "sqlite:///./sentinel.db"

    # Redis — ElastiCache for rate limiting + session cache
    REDIS_URL: str = ""

    # Auth — from Secrets Manager in prod, auto-generated in dev
    SECRET_KEY: str = _aws_secrets.get("SECRET_KEY", secrets.token_hex(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440

    # CORS — set via env var in production (comma-separated string or JSON array)
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

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

    # PII encryption key — from Secrets Manager in prod
    PII_ENCRYPTION_KEY: str = _aws_secrets.get("PII_ENCRYPTION_KEY", secrets.token_hex(32))

    # AWS
    AWS_REGION: str = "ap-south-1"
    S3_REPORTS_BUCKET: str = ""

    # Seed control — NEVER true in production
    SEED_ON_STARTUP: bool = False

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        # Render provides postgres:// but SQLAlchemy 2.x requires postgresql://
        return v.replace("postgres://", "postgresql://", 1) if isinstance(v, str) else v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        # Accept comma-separated string (Render env var) or a list
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra environment variables without validation errors


settings = Settings()
