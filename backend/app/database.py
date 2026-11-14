from collections.abc import Generator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Shared SQLAlchemy declarative base for all database models."""


def create_db_engine(database_url: str) -> Engine | None:
    if not database_url:
        return None

    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    return create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


settings = get_settings()
engine: Engine | None = create_db_engine(settings.DATABASE_URL)
SessionLocal = (
    sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)
    if engine is not None
    else None
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped SQLAlchemy session."""
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> tuple[bool, str]:
    """Verify PostgreSQL connectivity using a lightweight SELECT 1 probe."""
    if engine is None:
        return False, "DATABASE_URL is not configured in backend/.env."

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "PostgreSQL connection healthy."
    except Exception as exc:
        return False, f"Database connection failed: {type(exc).__name__}"
