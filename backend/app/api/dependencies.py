
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.entities import Project, ProjectMember, User, UserRole


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        subject = payload.get("sub")
        if not subject:
            raise unauthorized
        user_id = UUID(subject)
    except (JWTError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise unauthorized

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )

    return current_user


def get_active_user(
    user_id: UUID,
    db: Session,
    not_found_status: int = status.HTTP_404_NOT_FOUND,
) -> User:
    """Return an active user or raise HTTPException with the caller's status code."""
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.is_active.is_(True),
        )
    )
    if user is None:
        raise HTTPException(
            status_code=not_found_status,
            detail="Active user not found",
        )
    return user


def ensure_project_access(
    project: Project | None,
    user: User,
    is_member: bool,
    forbidden_detail: str = "You are not a member of this project",
) -> Project:
    """Validate project existence, active state, and membership consistently."""
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role != UserRole.admin and not project.is_active:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role != UserRole.admin and not is_member:
        raise HTTPException(status_code=403, detail=forbidden_detail)

    return project


def require_project_access(
    project_id: UUID,
    user: User,
    db: Session,
    allow_deleted_admin: bool = False,
) -> Project:
    """Ensure the project exists, is active for non-admins, and user has membership."""
    query = select(Project).where(Project.id == project_id)
    if not (allow_deleted_admin and user.role == UserRole.admin):
        query = query.where(Project.deleted_at.is_(None))
    project = db.scalar(query)

    is_member = True
    if project is not None and user.role != UserRole.admin:
        is_member = db.get(ProjectMember, (project_id, user.id)) is not None

    return ensure_project_access(project, user, is_member=is_member)
