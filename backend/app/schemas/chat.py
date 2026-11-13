from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CitationItem(BaseModel):
    n: int
    chunk_id: UUID
    document_id: UUID
    filename: str
    page_start: int | None = None
    page_end: int | None = None
    section_title: str | None = None
    score: float
    snippet: str


class ChatRequest(BaseModel):
    conversation_id: UUID | None = None
    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[UUID] | None = None


class ChatResponse(BaseModel):
    conversation_id: UUID
    message_id: UUID
    answer: str
    grounded: bool
    citations: list[CitationItem]


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    grounded: bool | None = None
    citations: list[CitationItem] = []
    created_at: datetime


class ConversationListItem(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class FeedbackRequest(BaseModel):
    rating: int = Field(description="1 for helpful, -1 for unhelpful")
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("Rating must be either 1 or -1")
        return v


class UnansweredQuestionResponse(BaseModel):
    id: UUID
    question: str
    top_score: float | None = None
    status: str
    message_id: UUID | None = None
    created_at: datetime


class UpdateUnansweredStatusRequest(BaseModel):
    status: str = Field(pattern="^(open|resolved|ignored)$")

