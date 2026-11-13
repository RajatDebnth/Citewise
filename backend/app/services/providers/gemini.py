import asyncio
import math
import random
import time
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from app.core.config import settings
from app.core.errors import AppException
from app.core.logging import get_logger
from app.services.providers.base import EmbeddingProvider, LLMProvider
from google import genai
from google.genai import types

logger = get_logger("app.providers.gemini")

T = TypeVar("T")


def l2_normalize(vector: list[float]) -> list[float]:
    """Applies L2 normalization to an embedding vector."""
    squared_sum = sum(x * x for x in vector)
    norm = math.sqrt(squared_sum)
    if norm == 0.0:
        return vector
    return [x / norm for x in vector]


class TokenBucketLimiter:
    """Token bucket rate limiter enforcing RPM limits."""

    def __init__(self, rpm: int):
        self.rpm = rpm
        self.capacity = float(rpm)
        self.tokens = float(rpm)
        self.fill_rate = float(rpm) / 60.0 if rpm > 0 else 0.0
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: float = 1.0) -> None:
        if self.rpm <= 0:
            return
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self.last_update
                self.last_update = now
                self.tokens = min(self.capacity, self.tokens + elapsed * self.fill_rate)
                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return
                needed = tokens - self.tokens
                wait_time = needed / self.fill_rate
                await asyncio.sleep(wait_time)


async def execute_with_retry(
    func: Callable[[], Awaitable[T]],
    max_retries: int = 5,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
) -> T:
    """Executes an async call with jittered exponential backoff on 429/5xx errors."""
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            return await func()
        except Exception as e:
            err_str = str(e).lower()
            is_retryable = (
                "429" in err_str
                or "resource_exhausted" in err_str
                or "500" in err_str
                or "503" in err_str
                or "504" in err_str
                or "unavailable" in err_str
                or "deadline" in err_str
            )
            if not is_retryable or attempt == max_retries - 1:
                logger.error(f"Gemini call failed permanently on attempt {attempt + 1}: {e}")
                raise
            jitter = random.uniform(0.1, 0.5) * delay
            sleep_time = delay + jitter
            logger.warning(
                f"Gemini call error ({e}), retrying attempt {attempt + 1}/{max_retries} in {sleep_time:.2f}s"
            )
            await asyncio.sleep(sleep_time)
            delay *= backoff_factor
    raise RuntimeError("Retry loop exhausted unexpectedly")


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using Google Gemini Embeddings API."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        dimension: int | None = None,
        rpm: int | None = None,
        batch_size: int | None = None,
    ):
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._model = model or settings.EMBED_MODEL
        self._dimension = dimension or settings.EMBED_DIM
        self._batch_size = batch_size or settings.EMBED_BATCH
        self._limiter = TokenBucketLimiter(rpm if rpm is not None else settings.GEMINI_RPM)
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self._api_key:
                raise AppException(
                    status_code=500,
                    code="gemini_config_error",
                    message="GEMINI_API_KEY is not configured",
                )
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Batches texts up to EMBED_BATCH, generates embeddings with RETRIEVAL_DOCUMENT, and normalizes."""
        if not texts:
            return []

        all_embeddings: list[list[float]] = []

        # Process in slices of batch_size
        for i in range(0, len(texts), self._batch_size):
            batch = texts[i : i + self._batch_size]

            await self._limiter.acquire(1.0)

            async def _call(current_batch: list[str] = batch) -> types.EmbedContentResponse:
                config = types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self._dimension,
                )
                return await self.client.aio.models.embed_content(
                    model=self._model,
                    contents=current_batch,
                    config=config,
                )

            resp = await execute_with_retry(_call)
            if not resp.embeddings:
                raise AppException(
                    status_code=500,
                    code="gemini_embedding_error",
                    message="Gemini returned empty embeddings",
                )

            for emb in resp.embeddings:
                raw_vec = emb.values
                if len(raw_vec) != self._dimension:
                    raise AppException(
                        status_code=500,
                        code="gemini_embedding_dim_error",
                        message=f"Gemini returned vector of length {len(raw_vec)}, expected {self._dimension}",
                    )
                all_embeddings.append(l2_normalize(raw_vec))

        return all_embeddings

    async def embed_query(self, text: str) -> list[float]:
        """Embeds a single query with RETRIEVAL_QUERY task type and L2 normalization."""
        await self._limiter.acquire(1.0)

        async def _call() -> types.EmbedContentResponse:
            config = types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=self._dimension,
            )
            return await self.client.aio.models.embed_content(
                model=self._model,
                contents=text,
                config=config,
            )

        resp = await execute_with_retry(_call)
        if not resp.embeddings or not resp.embeddings[0].values:
            raise AppException(
                status_code=500,
                code="gemini_embedding_error",
                message="Gemini returned empty embedding for query",
            )

        raw_vec = resp.embeddings[0].values
        if len(raw_vec) != self._dimension:
            raise AppException(
                status_code=500,
                code="gemini_embedding_dim_error",
                message=f"Gemini returned query vector of length {len(raw_vec)}, expected {self._dimension}",
            )
        return l2_normalize(raw_vec)


class GeminiLLMProvider(LLMProvider):
    """LLM generation provider using Google Gemini API."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        rpm: int | None = None,
    ):
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._model = model or settings.GEN_MODEL
        self._limiter = TokenBucketLimiter(rpm if rpm is not None else settings.GEMINI_RPM)
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self._api_key:
                raise AppException(
                    status_code=500,
                    code="gemini_config_error",
                    message="GEMINI_API_KEY is not configured",
                )
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    @property
    def model_name(self) -> str:
        return self._model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: dict[str, Any] | None = None,
    ) -> str:
        """Generates content via Gemini with optional JSON schema enforcement."""
        await self._limiter.acquire(1.0)

        config_kwargs: dict[str, Any] = {
            "system_instruction": system_prompt,
        }
        if response_schema is not None:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = response_schema

        config = types.GenerateContentConfig(**config_kwargs)

        async def _call() -> types.GenerateContentResponse:
            return await self.client.aio.models.generate_content(
                model=self._model,
                contents=user_prompt,
                config=config,
            )

        resp = await execute_with_retry(_call)
        return resp.text or ""


async def verify_embedding_dimension(provider: EmbeddingProvider) -> None:
    """Startup self-check verifying that provider returns vectors matching EMBED_DIM (768)."""
    test_vec = await provider.embed_query("startup self-check")
    if len(test_vec) != settings.EMBED_DIM:
        raise RuntimeError(
            f"FATAL: Embedding dimension mismatch! Configured {settings.EMBED_DIM}, but provider returned {len(test_vec)}"
        )
    logger.info(
        f"Verified embedding provider {provider.model_name}: dimension {len(test_vec)} == {settings.EMBED_DIM}"
    )
