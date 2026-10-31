
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RepositoryInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    repository_url: str | None = None
    branch_name: str | None = Field(default=None, max_length=255)
    technology: str | None = Field(default=None, max_length=100)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    project_lead_id: uuid.UUID
    member_ids: list[uuid.UUID] = Field(default_factory=list)
    repositories: list[RepositoryInput] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    project_lead_id: uuid.UUID | None = None


class ProjectStatusUpdate(BaseModel):
    is_active: bool


class ProjectMemberAdd(BaseModel):
    user_id: uuid.UUID


class ProjectMemberResponse(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    added_by: uuid.UUID
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    project_lead_id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectDetailResponse(ProjectResponse):
    members: list[ProjectMemberResponse] = Field(default_factory=list)
