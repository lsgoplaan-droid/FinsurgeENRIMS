import sys
import os
from contextlib import asynccontextmanager

# Add backend dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import create_tables, SessionLocal
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed if empty
    create_tables()
    db = SessionLocal()
    try:
        from app.models import User
        user_count = db.query(User).count()
        if user_count == 0:
            print("Database empty — seeding demo data...")
            from app.seed.seed_all import seed_all
            seed_all(db)
            print("Seeding complete!")
        else:
            print(f"Database has {user_count} users — skipping seed.")
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FinsurgeENRIMS — Enterprise Risk Management System for fraud & AML",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
