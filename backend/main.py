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
        elif user_count == 0:
            logger.warning("Database empty. Set SEED_ON_STARTUP=true to seed or run migrations.")
        else:
            logger.info(f"Database has {user_count} users — skipping seed.")
    finally:
        db.close()
    yield


# ── App creation ────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FinsurgeFRIMS — Enterprise Fraud Risk Management for fraud detection, cyber fraud, AI fraud & compliance",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Middleware (order matters: last added = first executed)
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware, login_limit=5, api_limit=100, window=60)
# CORS: use configured origins (must be set explicitly, even in dev)
# Default dev origins: localhost:5173 (Vite), localhost:3000 (Node)
_cors_origins = settings.CORS_ORIGINS  # No wildcard fallback—require explicit config
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── HTTPS Enforcement (S5) ──────────────────────────────────────────────────
# In production (ENVIRONMENT=production), redirect HTTP → HTTPS and add HSTS headers
# Set env var ENFORCE_HTTPS=true to enable
if os.getenv("ENFORCE_HTTPS", "false").lower() == "true":
    @app.middleware("http")
    async def https_redirect_middleware(request: Request, call_next):
        # Redirect HTTP to HTTPS
        if request.url.scheme == "http":
            https_url = request.url.replace(scheme="https")
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=https_url, status_code=301)

        response = await call_next(request)

        # Add HSTS header (Strict-Transport-Security)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

# Global exception handler — no stack traces in production
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=settings.DEBUG)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error" if not settings.DEBUG else str(exc)},
    )

# Prometheus auto-instrumentation (request latency, count, size)
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/metrics", "/docs", "/redoc", "/openapi.json"],
).instrument(app)

app.include_router(api_router)

# ── Diagnostic logging ──────────────────────────────────────────────────────
if settings.DEBUG:
    compliance_routes = [r.path for r in app.routes if hasattr(r, 'path') and 'compliance' in r.path]
    logger.info(f"Registered {len(compliance_routes)} compliance routes: {sorted(compliance_routes)}")

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
