import sys
import os
import logging
import json
from datetime import datetime
from contextlib import asynccontextmanager

# Add backend dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import create_tables, SessionLocal
from app.api.router import api_router
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.audit import AuditMiddleware


# ── Structured logging ──────────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "environment": settings.ENVIRONMENT,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG, handlers=[handler])
logger = logging.getLogger("finsurge")


# ── App lifecycle ───────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    db = SessionLocal()
    try:
        from app.models import User
        user_count = db.query(User).count()
        if user_count == 0 and settings.SEED_ON_STARTUP:
            logger.info("Database empty + SEED_ON_STARTUP=true — seeding demo data...")
            from app.seed.seed_all import seed_all
            seed_all(db)
            logger.info("Seeding complete!")
        elif user_count == 0 and settings.ENVIRONMENT == "development":
            logger.info("Database empty (dev mode) — seeding demo data...")
            from app.seed.seed_all import seed_all
            seed_all(db)
            logger.info("Seeding complete!")
        elif user_count == 0:
            logger.warning("Database empty but SEED_ON_STARTUP is not enabled. Set SEED_ON_STARTUP=true or run migrations.")
        else:
            logger.info(f"Database has {user_count} users — skipping seed.")
    finally:
        db.close()
    yield


# ── App creation ────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FinsurgeENRIMS — Enterprise Fraud Risk Management for AML, fraud detection & compliance",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Middleware (order matters: last added = first executed)
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware, login_limit=5, api_limit=100, window=60)
# In production, CORS_ORIGINS env var must be set to specific domains
_cors_origins = settings.CORS_ORIGINS if settings.ENVIRONMENT != "development" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False if _cors_origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Global exception handler — no stack traces in production
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=settings.DEBUG)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error" if not settings.DEBUG else str(exc)},
    )

app.include_router(api_router)


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    """Enhanced health check — verifies DB + Redis connectivity."""
    # DB check
    try:
        db = SessionLocal()
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    # Redis check (if configured)
    redis_status = "not configured"
    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=2)
            r.ping()
            redis_status = "connected"
        except Exception as e:
            redis_status = f"error: {e}"

    all_healthy = db_status == "connected" and redis_status in ("connected", "not configured")

    return {
        "status": "healthy" if all_healthy else "degraded",
        "database": db_status,
        "redis": redis_status,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
