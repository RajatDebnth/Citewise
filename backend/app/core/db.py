import re
from collections.abc import AsyncGenerator

from pgvector.asyncpg import register_vector
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("app.db")

Base = declarative_base()


def get_clean_database_url() -> str:
    url = settings.DATABASE_URL
    if not url:
        return ""
    # Ensure scheme is postgresql+asyncpg://
    if not url.startswith("postgresql+asyncpg://"):
        url = re.sub(r"^postgresql://", "postgresql+asyncpg://", url)
    return url


def create_engine() -> AsyncEngine:
    db_url = get_clean_database_url()
    return create_async_engine(
        db_url,
        pool_size=settings.DB_POOL_MAX,
        max_overflow=0,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "server_settings": {"jit": "off"},
        },
    )


engine: AsyncEngine = create_engine()
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def register_pgvector(conn: AsyncConnection) -> None:
    """Registers vector type with asyncpg on the raw driver connection."""
    try:
        raw_conn = await conn.get_raw_connection()
        if hasattr(raw_conn, "driver_connection"):
            await register_vector(raw_conn.driver_connection)
    except (AttributeError, RuntimeError, OSError) as e:
        logger.warning(f"Could not register pgvector on connection: {e}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
