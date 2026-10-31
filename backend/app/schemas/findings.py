
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.entities import FindingSeverity, FindingStatus


class FindingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    description: str = Field(min_length=1)
    project_id: uuid.UUID
    repository_id: uuid.UUID
    branch_name: str | None = Field(default=None, max_length=255)
    severity: FindingSeverity
    category: str = Field(min_length=1, max_length=100)
    assignee_id: uuid.UUID
    reviewer_id: uuid.UUID | None = None
    due_date: date


class FindingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = Field(default=None, min_length=1)
    repository_id: uuid.UUID | None = None
    branch_name: str | None = Field(default=None, max_length=255)
    severity: FindingSeverity | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    assignee_id: uuid.UUID | None = None
    reviewer_id: uuid.UUID | None = None
    due_date: date | None = None


class FindingStatusUpdate(BaseModel):
    status: FindingStatus
    reason: str | None = Field(default=None, max_length=2000)


class FindingReassignRequest(BaseModel):
    assignee_id: uuid.UUID
    feedback: str | None = Field(default=None, max_length=2000)
    reason: str | None = Field(default=None, max_length=2000)


class FindingResponse(BaseModel):
    id: uuid.UUID
    finding_code: str
    title: str
    description: str
    project_id: uuid.UUID
    repository_id: uuid.UUID
    branch_name: str | None
    severity: FindingSeverity
    category: str
    status: FindingStatus
    assignee_id: uuid.UUID
    reviewer_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    due_date: date
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FindingStatusHistoryResponse(BaseModel):
    id: uuid.UUID
    old_status: FindingStatus | None
    new_status: FindingStatus
    changed_by: uuid.UUID
    reason: str | None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FindingDetailResponse(FindingResponse):
    status_history: list[FindingStatusHistoryResponse] = []
