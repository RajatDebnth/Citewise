import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from app.core.config import settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Force test environment so NullPool is used across async test loops
settings.APP_ENV = "test"

from app.core.db import AsyncSessionLocal, engine


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


@pytest.fixture(autouse=True)
def setup_test_env():
    settings.APP_ENV = "test"


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a database session for testing."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def create_user():
    """Helper fixture to insert test users into auth.users and profiles."""
    created_uids = []

    async def _create(user_id: str, email: str, display_name: str | None = None):
        async with engine.begin() as conn:
            # Delete any existing user with this email or id so clean state is guaranteed
            await conn.execute(
                text("DELETE FROM auth.users WHERE email = :email OR id = :uid"),
                {"uid": user_id, "email": email},
            )
            # Insert into auth.users (Supabase Auth table)
            await conn.execute(
                text(
                    """
                    INSERT INTO auth.users (id, email, raw_user_meta_data)
                    VALUES (:uid, :email, '{}'::jsonb);
                    """
                ),
                {"uid": user_id, "email": email},
            )
            # Insert or update public.profiles
            await conn.execute(
                text(
                    """
                    INSERT INTO public.profiles (id, email, display_name)
                    VALUES (:uid, :email, :name)
                    ON CONFLICT (id) DO UPDATE SET email = :email, display_name = :name;
                    """
                ),
                {"uid": user_id, "email": email, "name": display_name or email.split("@")[0]},
            )
            created_uids.append(user_id)

    yield _create

    # Cleanup created test users
    if created_uids:
        async with engine.begin() as conn:
            for uid in created_uids:
                try:
                    await conn.execute(text("DELETE FROM auth.users WHERE id = :uid"), {"uid": uid})
                except (OSError, RuntimeError):
                    pass
