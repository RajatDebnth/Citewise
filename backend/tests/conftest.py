import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from app.core.config import settings
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
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


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Initializes the database schema if running against a database."""
    try:
        async with engine.begin() as conn:
            # Create auth schema, mock roles, and users table if not exists (simulates Supabase Auth)
            await conn.execute(
                text(
                    """
                    DO $$ BEGIN
                      CREATE ROLE anon;
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END $$;
                    DO $$ BEGIN
                      CREATE ROLE authenticated;
                    EXCEPTION WHEN duplicate_object THEN NULL;
                    END $$;
                    CREATE SCHEMA IF NOT EXISTS auth;
                    CREATE TABLE IF NOT EXISTS auth.users (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        email text UNIQUE,
                        raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
                        created_at timestamptz DEFAULT now()
                    );
                    """
                )
            )
            sql = _load_migration_sql()
            if sql:
                await conn.execute(text(sql))
    except (OSError, SQLAlchemyError) as exc:
        # If DB connection is unavailable in the environment, log and continue for unit tests
        print(f"Test DB initialization notice: {exc}")


@pytest.fixture(autouse=True)
def setup_test_env():
    settings.APP_ENV = "test"


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields a database session for testing."""
    try:
        async with AsyncSessionLocal() as session:
            yield session
    except (OSError, SQLAlchemyError) as exc:
        pytest.skip(f"Database not available: {exc}")


@pytest_asyncio.fixture
async def create_user():
    """Helper fixture to insert test users into auth.users and profiles."""
    created_uids = []

    async def _create(user_id: str, email: str, display_name: str | None = None):
        try:
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
        except (OSError, SQLAlchemyError) as exc:
            pytest.skip(f"Database not available: {exc}")

    yield _create

    # Cleanup created test users
    if created_uids:
        try:
            async with engine.begin() as conn:
                for uid in created_uids:
                    try:
                        await conn.execute(text("DELETE FROM auth.users WHERE id = :uid"), {"uid": uid})
                    except (OSError, SQLAlchemyError):
                        pass
        except (OSError, SQLAlchemyError):
            pass

