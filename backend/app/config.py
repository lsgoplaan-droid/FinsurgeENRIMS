from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    APP_NAME: str = "FinsurgeENRIMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./sentinel.db"

    SECRET_KEY: str = "finsurge-enrims-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    CORS_ORIGINS: list[str] = ["*"]

    CTR_THRESHOLD_PAISE: int = 1000000_00  # INR 10,00,000
    SLA_CRITICAL_HOURS: int = 4
    SLA_HIGH_HOURS: int = 24
    SLA_MEDIUM_HOURS: int = 72
    SLA_LOW_HOURS: int = 168

    class Config:
        env_file = ".env"


settings = Settings()
