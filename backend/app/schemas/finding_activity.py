
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FindingFeedbackCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    parent_feedback_id: UUID | None = None


class FindingFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    finding_id: UUID
    author_id: UUID
    parent_feedback_id: UUID | None
    body: str
    created_at: datetime
    updated_at: datetime | None


class FindingWorkHistoryCreate(BaseModel):
    entry_type: str = Field(min_length=1, max_length=30)
    body: str = Field(min_length=1, max_length=10000)


class FindingWorkHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    finding_id: UUID
    author_id: UUID
    entry_type: str
    body: str
    created_at: datetime
