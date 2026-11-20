import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_admin, require_project_access
from app.api.routes.findings.shared import (
    generate_finding_code,
    get_active_finding,
    get_project_member_user,
)
from app.database import get_db
from app.models.entities import (
    Finding,
    FindingStatus,
    FindingStatusHistory,
    Project,
    ProjectMember,
    Repository,
    User,
    UserRole,
)
from app.schemas.findings import (
    FindingCreate,
    FindingDetailResponse,
    FindingResponse,
    FindingUpdate,
)

router = APIRouter()


@router.post(
    "",
    response_model=FindingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_finding(
    payload: FindingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_access(payload.project_id, current_user, db)

    repository = db.scalar(
        select(Repository).where(
            Repository.id == payload.repository_id,
            Repository.project_id == payload.project_id,
            Repository.is_active.is_(True),
        )
    )

    if repository is None:
        raise HTTPException(
            status_code=422,
            detail="Repository must be active and belong to the selected project",
        )

    get_project_member_user(
        payload.project_id,
        payload.assignee_id,
        db,
        "Assignee must be a member of the project",
    )

    if payload.reviewer_id is not None:
        get_project_member_user(
            payload.project_id,
            payload.reviewer_id,
            db,
            "Reviewer must be a member of the project",
        )

    finding = Finding(
        finding_code=generate_finding_code(db),
        title=payload.title.strip(),
        description=payload.description,
        project_id=payload.project_id,
        repository_id=payload.repository_id,
        branch_name=payload.branch_name,
        severity=payload.severity,
        category=payload.category.strip(),
        status=FindingStatus.open,
        assignee_id=payload.assignee_id,
        reviewer_id=payload.reviewer_id,
        created_by=current_user.id,
        due_date=payload.due_date,
    )

    db.add(finding)
    db.flush()

    db.add(
        FindingStatusHistory(
            finding_id=finding.id,
            old_status=None,
            new_status=FindingStatus.open,
            changed_by=current_user.id,
            reason="Finding created",
        )
    )

    db.commit()
    db.refresh(finding)
    return finding


@router.get("", response_model=list[FindingResponse])
def list_findings(
    project_id: uuid.UUID | None = None,
    finding_status: FindingStatus | None = Query(default=None, alias="status"),
    assignee_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Finding)
        .options(selectinload(Finding.status_history))
        .join(Project, Project.id == Finding.project_id)
        .where(
            Finding.deleted_at.is_(None),
            Project.deleted_at.is_(None),
        )
    )

    if current_user.role != UserRole.admin:
        query = query.where(Project.is_active.is_(True))

    if project_id is not None:
        require_project_access(project_id, current_user, db)
        query = query.where(Finding.project_id == project_id)
    elif current_user.role != UserRole.admin:
        query = query.join(
            ProjectMember,
            ProjectMember.project_id == Finding.project_id,
        ).where(ProjectMember.user_id == current_user.id)

    if finding_status is not None:
        query = query.where(Finding.status == finding_status)

    if assignee_id is not None:
        query = query.where(Finding.assignee_id == assignee_id)

    return db.scalars(
        query.order_by(Finding.created_at.desc())
    ).unique().all()


@router.get("/{finding_id}", response_model=FindingDetailResponse)
def get_finding(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)
    return finding


@router.patch("/{finding_id}", response_model=FindingResponse)
def update_finding(
    finding_id: uuid.UUID,
    payload: FindingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    if (
        current_user.role != UserRole.admin
        and finding.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Only the finding creator or an admin can edit this finding",
        )

    changes = payload.model_dump(exclude_unset=True)

    if "title" in changes:
        if not changes["title"] or not changes["title"].strip():
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        changes["title"] = changes["title"].strip()

    if "category" in changes:
        if not changes["category"] or not changes["category"].strip():
            raise HTTPException(
                status_code=422,
                detail="Category cannot be empty",
            )
        changes["category"] = changes["category"].strip()

    if "repository_id" in changes:
        repository = db.scalar(
            select(Repository).where(
                Repository.id == changes["repository_id"],
                Repository.project_id == finding.project_id,
                Repository.is_active.is_(True),
            )
        )

        if repository is None:
            raise HTTPException(
                status_code=422,
                detail="Repository must be active and belong to the finding's project",
            )

    if "assignee_id" in changes and changes["assignee_id"] is not None:
        get_project_member_user(
            finding.project_id,
            changes["assignee_id"],
            db,
            "Assignee must be a project member",
        )

    if "reviewer_id" in changes and changes["reviewer_id"] is not None:
        get_project_member_user(
            finding.project_id,
            changes["reviewer_id"],
            db,
            "Reviewer must be a project member",
        )

    for field, value in changes.items():
        setattr(finding, field, value)

    finding.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(finding)
    return finding


@router.delete(
    "/{finding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_finding(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    finding = get_active_finding(finding_id, db)
    finding.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
