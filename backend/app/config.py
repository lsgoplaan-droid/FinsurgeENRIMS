import os
import secrets
import json
import logging
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
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Database — SQLite for dev, PostgreSQL (RDS/Render) for production
    # Render provides postgres:// URLs; SQLAlchemy 2.x requires postgresql://
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sentinel.db").replace(
        "postgres://", "postgresql://", 1
    )

    # Redis — ElastiCache for rate limiting + session cache
    REDIS_URL: str = os.getenv("REDIS_URL", "")

    # Auth — from Secrets Manager in prod, auto-generated in dev
    SECRET_KEY: str = os.getenv("SECRET_KEY", _aws_secrets.get("SECRET_KEY", secrets.token_hex(32)))
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

    # PII encryption key — from Secrets Manager in prod
    PII_ENCRYPTION_KEY: str = os.getenv("PII_ENCRYPTION_KEY", _aws_secrets.get("PII_ENCRYPTION_KEY", secrets.token_hex(32)))

    # AWS
    AWS_REGION: str = os.getenv("AWS_REGION", "ap-south-1")
    S3_REPORTS_BUCKET: str = os.getenv("S3_REPORTS_BUCKET", "")

    # Seed control — NEVER true in production
    SEED_ON_STARTUP: bool = os.getenv("SEED_ON_STARTUP", "false").lower() == "true"

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra environment variables without validation errors


settings = Settings()
