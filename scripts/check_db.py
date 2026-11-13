import asyncio
import os
import re
import sys

import asyncpg

EXPECTED_TABLES = [
    "profiles",
    "workspaces",
    "workspace_members",
    "documents",
    "document_chunks",
    "embedding_cache",
    "conversations",
    "messages",
    "message_feedback",
    "unanswered_questions",
    "usage_events",
    "audit_log",
    "app_settings",
]


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


async def main() -> int:
    env = load_env("backend/.env")
    db_url = env.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set in backend/.env")
        return 1

    clean_url = re.sub(r"^postgresql\+[a-zA-Z0-9_-]+://", "postgresql://", db_url)
    print("Connecting to database for verification...")
    conn = await asyncpg.connect(clean_url, timeout=20, ssl="require")

    passed = True
    try:
        # 1. Extensions
        print("\n--- 1. Checking Extensions ---")
        extensions = await conn.fetch(
            "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pgcrypto');"
        )
        ext_dict = {r["extname"]: r["extversion"] for r in extensions}
        for ext in ["vector", "pgcrypto"]:
            if ext in ext_dict:
                print(f" [PASS] Extension '{ext}' is installed (v{ext_dict[ext]})")
            else:
                print(f" [FAIL] Extension '{ext}' is MISSING")
                passed = False

        # 2. Tables & RLS flags
        print("\n--- 2. Checking Tables and RLS Status ---")
        table_rows = await conn.fetch(
            """
            SELECT c.relname as table_name, c.relrowsecurity as rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[]);
            """,
            EXPECTED_TABLES,
        )
        found_tables = {r["table_name"]: r["rls_enabled"] for r in table_rows}

        for table in EXPECTED_TABLES:
            if table not in found_tables:
                print(f" [FAIL] Table '{table}' is MISSING")
                passed = False
            elif not found_tables[table]:
                print(f" [FAIL] Table '{table}' exists but RLS is NOT enabled")
                passed = False
            else:
                print(f" [PASS] Table '{table}' exists and RLS is enabled")

        # 3. App Settings
        print("\n--- 3. Checking App Settings Seed ---")
        settings_rows = await conn.fetch("SELECT key, value FROM app_settings;")
        settings_dict = {r["key"]: r["value"] for r in settings_rows}
        for k in ["uploads_enabled", "chat_enabled", "global_max_chunks"]:
            if k in settings_dict:
                print(f" [PASS] app_settings contains '{k}': {settings_dict[k]}")
            else:
                print(f" [FAIL] app_settings missing key '{k}'")
                passed = False

        # 4. match_chunks function execution
        print("\n--- 4. Checking match_chunks function ---")
        dummy_vector = "[" + ",".join(["0.0"] * 768) + "]"
        try:
            chunks = await conn.fetch(
                """
                SELECT * FROM match_chunks(
                    p_workspace_id => gen_random_uuid(),
                    p_query => $1::vector,
                    p_k => 3
                );
                """,
                dummy_vector,
            )
            print(
                f" [PASS] match_chunks executed successfully (returned {len(chunks)} rows for random workspace)"
            )
        except (asyncpg.PostgresError, OSError) as e:
            print(f" [FAIL] match_chunks execution error: {e}")
            passed = False

        # 5. claim_document_job function
        print("\n--- 5. Checking claim_document_job function ---")
        try:
            job = await conn.fetch("SELECT * FROM claim_document_job('10 minutes');")
            print(
                f" [PASS] claim_document_job executed successfully (returned {len(job)} jobs)"
            )
        except (asyncpg.PostgresError, OSError) as e:
            print(f" [FAIL] claim_document_job execution error: {e}")
            passed = False

    finally:
        await conn.close()

    if passed:
        print("\n>>> ALL DATABASE CHECKS PASSED SUCCESSFULLY! <<<")
        return 0
    else:
        print("\n>>> SOME DATABASE CHECKS FAILED! <<<")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
