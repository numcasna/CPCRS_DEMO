
import uuid
from app.models.entities import Repository
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Project, ProjectMember, User
from app.models.entities import UserRole
from app.api.dependencies import get_current_user, require_admin
from app.schemas.projects import (
    ProjectCreate,
    ProjectUpdate,
    ProjectMemberAdd,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectMemberResponse,
    ProjectStatusUpdate,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def get_active_project(project_id: uuid.UUID, db: Session) -> Project:
    project = db.scalar(
        select(Project)
        .where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
        .options(
            selectinload(Project.members),
            selectinload(Project.repositories),
        )
    )

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    return project


def check_project_access(project: Project, user: User) -> None:
    if user.role == UserRole.admin:
        return

    if not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")

    if not any(member.user_id == user.id for member in project.members):
        raise HTTPException(
            status_code=403,
            detail="You must be a project member to access this project",
        )


def get_active_user(user_id: uuid.UUID, db: Session) -> User:
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.is_active.is_(True),
        )
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Active user not found",
        )

    return user



@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate the selected project lead.
    lead = get_active_user(payload.project_lead_id, db)

    # The creator, lead, and selected members must all belong to the project.
    member_ids = {
        current_user.id,
        lead.id,
        *payload.member_ids,
    }

    active_users = db.scalars(
        select(User).where(
            User.id.in_(member_ids),
            User.is_active.is_(True),
        )
    ).all()

    active_user_ids = {user.id for user in active_users}

    if active_user_ids != member_ids:
        raise HTTPException(
            status_code=422,
            detail="One or more selected project members are not active users",
        )

    # Validate repository names before writing anything.
    repository_names = []

    for repository in payload.repositories:
        name = repository.name.strip()

        if not name:
            raise HTTPException(
                status_code=422,
                detail="Repository names cannot be empty",
            )

        repository_names.append((repository, name))

    project = Project(
        name=payload.name.strip(),
        description=payload.description,
        project_lead_id=lead.id,
        created_by=current_user.id,
    )

    try:
        db.add(project)
        db.flush()

        # Add the creator, lead, and selected members without duplicates.
        for user_id in member_ids:
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=user_id,
                    added_by=current_user.id,
                )
            )

        # Create all repositories for this project.
        for repository, name in repository_names:
            db.add(
                Repository(
                    project_id=project.id,
                    name=name,
                    repository_url=repository.repository_url,
                    branch_name=repository.branch_name,
                    technology=repository.technology,
                )
            )

        # Save everything together.
        db.commit()
        db.refresh(project)
        return project

    except Exception:
        db.rollback()
        raise



@router.get("", response_model=list[ProjectResponse])
def list_projects(
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Project)

    if current_user.role != UserRole.admin:
        # Developers can only see projects that are active and not deleted.
        query = query.where(
            Project.deleted_at.is_(None),
            Project.is_active.is_(True),
        ).join(
            ProjectMember,
            ProjectMember.project_id == Project.id,
        ).where(ProjectMember.user_id == current_user.id)
    elif not include_deleted:
        query = query.where(Project.deleted_at.is_(None))

    return db.scalars(
        query.order_by(Project.created_at.desc())
    ).unique().all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        project = db.scalar(
            select(Project)
            .where(Project.id == project_id)
            .options(selectinload(Project.members), selectinload(Project.repositories))
        )
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    project = get_active_project(project_id, db)
    if not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    return project


@router.patch("/{project_id}/status", response_model=ProjectResponse)
def update_project_status(
    project_id: uuid.UUID,
    payload: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = get_active_project(project_id, db)
    project.is_active = payload.is_active
    project.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(project)
        return project
    except Exception:
        db.rollback()
        raise


@router.post("/{project_id}/restore", response_model=ProjectResponse)
def restore_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.scalar(select(Project).where(Project.id == project_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.deleted_at is None:
        raise HTTPException(status_code=409, detail="Project is not deleted")
    project.deleted_at = None
    project.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(project)
        return project
    except Exception:
        db.rollback()
        raise


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_active_project(project_id, db)
    check_project_access(project, current_user)

    changes = payload.model_dump(exclude_unset=True)

    if "name" in changes:
        if changes["name"] is None:
            raise HTTPException(
                status_code=422,
                detail="Name cannot be null",
            )

        changes["name"] = changes["name"].strip()

        if not changes["name"]:
            raise HTTPException(
                status_code=422,
                detail="Name cannot be empty",
            )

    if "project_lead_id" in changes:
        lead_id = changes["project_lead_id"]

        if lead_id is None:
            raise HTTPException(
                status_code=422,
                detail="Project lead cannot be null",
            )

        lead = get_active_user(lead_id, db)
        project.project_lead_id = lead.id

        existing_member = db.get(
            ProjectMember,
            (project.id, lead.id),
        )

        if existing_member is None:
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=lead.id,
                    added_by=current_user.id,
                )
            )

    if "name" in changes:
        project.name = changes["name"]

    if "description" in changes:
        project.description = changes["description"]

    project.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(project)
        return project
    except Exception:
        db.rollback()
        raise


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_project_member(
    project_id: uuid.UUID,
    payload: ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_active_project(project_id, db)
    check_project_access(project, current_user)
    get_active_user(payload.user_id, db)

    existing = db.get(
        ProjectMember,
        (project.id, payload.user_id),
    )

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="User is already a project member",
        )

    member = ProjectMember(
        project_id=project.id,
        user_id=payload.user_id,
        added_by=current_user.id,
    )

    try:
        db.add(member)
        db.commit()
        db.refresh(member)
        return member
    except Exception:
        db.rollback()
        raise


@router.delete(
    "/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_active_project(project_id, db)
    check_project_access(project, current_user)

    if user_id == project.project_lead_id:
        raise HTTPException(
            status_code=409,
            detail="Assign a different project lead before removing this member",
        )

    member = db.get(ProjectMember, (project.id, user_id))

    if member is None:
        raise HTTPException(
            status_code=404,
            detail="Project member not found",
        )

    try:
        db.delete(member)
        db.commit()
        return None
    except Exception:
        db.rollback()
        raise


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = get_active_project(project_id, db)
    now = datetime.now(timezone.utc)
    project.deleted_at = now
    project.updated_at = now

    try:
        db.commit()
        return None
    except Exception:
        db.rollback()
        raise
