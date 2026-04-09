from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool, StaticPool, NullPool
from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# PostgreSQL: connection pooling via QueuePool
# SQLite: StaticPool with check_same_thread=False
if _is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
        echo=False,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,       # detect stale connections
        pool_recycle=1800,         # recycle after 30 min
        echo=False,
    )


# SQLite-specific pragmas (only when using SQLite)
if _is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from app.models import _register_all_models  # noqa
    Base.metadata.create_all(bind=engine)
