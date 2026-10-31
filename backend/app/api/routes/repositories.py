
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.models.entities import Project, ProjectMember, Repository, User, UserRole


router = APIRouter(tags=["Repositories"])


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


def check_project_access(
    project_id: uuid.UUID,
    user: User,
    db: Session,
    allow_deleted_admin: bool = False,
) -> Project:
    query = select(Project).where(Project.id == project_id)
    if not (allow_deleted_admin and user.role == UserRole.admin):
        query = query.where(Project.deleted_at.is_(None))
    project = db.scalar(query)

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role != UserRole.admin and not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role != UserRole.admin:
        membership = db.get(ProjectMember, (project_id, user.id))
        if membership is None:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this project",
            )

    return project


@router.post(
    "/projects/{project_id}/repositories",
    response_model=RepositoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_repository(
    project_id: uuid.UUID,
    payload: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(project_id, current_user, db)

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Repository name cannot be empty")

    repository = Repository(
        project_id=project_id,
        name=name,
        repository_url=(
            str(payload.repository_url) if payload.repository_url else None
        ),
        branch_name=payload.branch_name,
        technology=payload.technology,
    )

    db.add(repository)
    db.commit()
    db.refresh(repository)
    return repository


@router.get(
    "/projects/{project_id}/repositories",
    response_model=list[RepositoryResponse],
)
def list_repositories(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_access(
        project_id, current_user, db, allow_deleted_admin=True
    )

    query = (
        select(Repository)
        .where(
            Repository.project_id == project_id,
            Repository.is_active.is_(True),
        )
        .order_by(Repository.created_at.desc())
    )

    return db.scalars(query).all()
