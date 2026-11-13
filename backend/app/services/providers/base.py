from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Abstract interface for text embedding providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Returns the embedding vector dimension."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Returns the model identifier."""

    @abstractmethod
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Generates embeddings for a list of document chunks.
        
        Uses RETRIEVAL_DOCUMENT task type and applies L2 normalization.
        """

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Generates an embedding for a user search query.
        
        Uses RETRIEVAL_QUERY task type and applies L2 normalization.
        """


class LLMProvider(ABC):
    """Abstract interface for LLM text generation providers."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Returns the model identifier."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: dict | None = None,
    ) -> str:
        """Generates a text or structured JSON response."""
