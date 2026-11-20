
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_project_access
from app.database import get_db
from app.models.entities import Repository, User
from app.schemas.repositories import RepositoryCreate, RepositoryResponse


router = APIRouter(tags=["Repositories"])


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
    require_project_access(project_id, current_user, db)

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
    require_project_access(
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
