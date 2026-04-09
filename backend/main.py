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
        if user_count == 0:
            logger.info("Database empty — seeding demo data...")
            from app.seed.seed_all import seed_all
            seed_all(db)
            logger.info("Seeding complete!")
        else:
            logger.info(f"Database has {user_count} users — skipping seed.")
    finally:
        db.close()
    yield


# ── App creation ────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FinsurgeENRIMS — Enterprise Risk Management System for fraud & AML",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Middleware (order matters: last added = first executed)
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware, login_limit=5, api_limit=100, window=60)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/health")
def health():
    """Enhanced health check — verifies DB connectivity."""
    try:
        db = SessionLocal()
        db.execute("SELECT 1" if settings.DATABASE_URL.startswith("postgresql") else "SELECT 1")
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
