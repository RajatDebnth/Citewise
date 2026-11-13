
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "production"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str | list[str] = "http://localhost:5173"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWKS_URL: str = ""
    SUPABASE_JWT_SECRET: str = ""
    STORAGE_BUCKET: str = "documents"
    DATABASE_URL: str = ""
    DB_POOL_MAX: int = 5

    # Gemini
    GEMINI_API_KEY: str = ""
    GEN_MODEL: str = "gemini-2.5-flash"
    EMBED_MODEL: str = "gemini-embedding-001"
    EMBED_DIM: int = 768
    EMBED_BATCH: int = 50
    LLM_TIER: str = "free"
    GEMINI_RPM: int = 15
    GEMINI_DAILY_CALL_BUDGET: int = 1500

    # RAG
    TOP_K: int = 5
    RETRIEVAL_MIN_SCORE: float = 0.50
    CHUNK_TOKENS: int = 800
    CHUNK_OVERLAP: int = 120
    CONDENSE_ENABLED: bool = True

    # Limits
    MAX_FILE_MB: int = 10
    MAX_PAGES: int = 150
    MAX_CHUNKS_PER_DOC: int = 400
    MAX_WORKSPACES_PER_USER: int = 3
    MAX_DOCS_PER_WORKSPACE: int = 10
    MAX_CHUNKS_PER_USER: int = 1500
    DAILY_QUESTIONS_PER_USER: int = 30
    DAILY_UPLOADS_PER_USER: int = 10
    DEMO_QUESTIONS_PER_IP_DAY: int = 15
    KEEP_ORIGINALS: bool = True

    # Turnstile
    TURNSTILE_SECRET_KEY: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json

                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(i).strip() for i in parsed if str(i).strip()]
                except json.JSONDecodeError:
                    return []
            return [i.strip() for i in v.split(",") if i.strip()]
        if isinstance(v, list):
            return [str(i).strip() for i in v if str(i).strip()]
        return []


settings = Settings()

