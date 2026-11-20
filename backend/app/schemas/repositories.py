import uuid

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    repository_url: HttpUrl | None = None
    branch_name: str | None = Field(default=None, max_length=255)
    technology: str | None = Field(default=None, max_length=100)


class RepositoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    repository_url: str | None
    branch_name: str | None
    technology: str | None
    is_active: bool

