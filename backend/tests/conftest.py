import os
from collections.abc import AsyncGenerator

import pytest_asyncio
from app.core.db import AsyncSessionLocal, engine
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _load_migration_sql() -> str:
    possible_paths = [
        "supabase/migrations/0001_init.sql",
        "../supabase/migrations/0001_init.sql",
    ]
    migration_path = next((p for p in possible_paths if os.path.exists(p)), None)
    if migration_path:
        with open(migration_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


@pytest_asyncio.fixture(scope="session")
async def apply_test_migrations():
    """Applies supabase/migrations/0001_init.sql if needed."""
    sql = _load_migration_sql()
    if sql:
        async with engine.begin() as conn:
            await conn.execute(text(sql))
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a database session for testing."""
    async with AsyncSessionLocal() as session:
        yield session
