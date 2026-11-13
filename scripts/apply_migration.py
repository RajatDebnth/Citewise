import asyncio
import os
import re

import asyncpg


def load_env(path: str) -> dict[str, str]:
    env = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().split("#")[0].strip()
    return env


def load_migration_sql(path: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


async def main():
    env = load_env("backend/.env")
    db_url = env.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not found in backend/.env")
        return

    clean_url = re.sub(r"^postgresql\+[a-zA-Z0-9_-]+://", "postgresql://", db_url)

    migration_path = "supabase/migrations/0001_init.sql"
    sql = load_migration_sql(migration_path)
    if not sql:
        print(f"ERROR: Migration file {migration_path} does not exist or is empty")
        return

    print(f"Connecting to database to apply {migration_path}...")
    conn = await asyncpg.connect(clean_url, timeout=30, ssl="require")
    try:
        print("Executing migration SQL...")
        await conn.execute(sql)
        print("SUCCESS: Migration applied cleanly to database!")
    except Exception as e:
        print(f"ERROR applying migration: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
