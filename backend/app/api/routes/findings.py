
import uuid
from datetime import datetime, timezone
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.api.dependencies import get_current_user, require_admin
from app.models.entities import (
    Finding,
    FindingCodeCounter,
    FindingStatus,
    FindingStatusHistory,
    Project,
    ProjectMember,
    Repository,
    User,
    UserRole,
    FindingFeedback,
    FindingWorkHistory,
    FindingAttachment,
)
from app.schemas.findings import (
    FindingCreate,
    FindingUpdate,
    FindingStatusUpdate,
    FindingReassignRequest,
    FindingResponse,
    FindingDetailResponse,
    FindingStatusHistoryResponse,
)
from app.schemas.finding_activity import (
    FindingFeedbackCreate,
    FindingFeedbackResponse,
    FindingWorkHistoryCreate,
    FindingWorkHistoryResponse,
)

router = APIRouter(prefix="/findings", tags=["Findings"])


def require_project_access(
    project_id: uuid.UUID,
    user: User,
    db: Session,
) -> Project:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )

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


def get_active_finding(
    finding_id: uuid.UUID,
    db: Session,
) -> Finding:
    finding = db.scalar(
        select(Finding)
        .where(
            Finding.id == finding_id,
            Finding.deleted_at.is_(None),
        )
        .options(selectinload(Finding.status_history))
    )

    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    return finding


def get_active_user(user_id: uuid.UUID, db: Session) -> User:
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.is_active.is_(True),
        )
    )

    if user is None:
        raise HTTPException(status_code=422, detail="Active user not found")

    return user


def generate_finding_code(db: Session) -> str:
    year = datetime.now(timezone.utc).year

    db.execute(
        pg_insert(FindingCodeCounter)
        .values(year=year, last_value=0)
        .on_conflict_do_nothing(index_elements=["year"])
    )

    counter = db.scalar(
        select(FindingCodeCounter)
        .where(FindingCodeCounter.year == year)
        .with_for_update()
    )

    counter.last_value += 1
    return f"FND-{year}-{counter.last_value:04d}"


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

    assignee = get_active_user(payload.assignee_id, db)
    if db.get(ProjectMember, (payload.project_id, assignee.id)) is None:
        raise HTTPException(
            status_code=422,
            detail="Assignee must be a member of the project",
        )

    if payload.reviewer_id is not None:
        reviewer = get_active_user(payload.reviewer_id, db)
        if db.get(ProjectMember, (payload.project_id, reviewer.id)) is None:
            raise HTTPException(
                status_code=422,
                detail="Reviewer must be a member of the project",
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
        assignee = get_active_user(changes["assignee_id"], db)
        if db.get(ProjectMember, (finding.project_id, assignee.id)) is None:
            raise HTTPException(
                status_code=422,
                detail="Assignee must be a project member",
            )

    if "reviewer_id" in changes and changes["reviewer_id"] is not None:
        reviewer = get_active_user(changes["reviewer_id"], db)
        if db.get(ProjectMember, (finding.project_id, reviewer.id)) is None:
            raise HTTPException(
                status_code=422,
                detail="Reviewer must be a project member",
            )

    for field, value in changes.items():
        setattr(finding, field, value)

    finding.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(finding)
    return finding


@router.patch("/{finding_id}/status", response_model=FindingResponse)
def update_finding_status(
    finding_id: uuid.UUID,
    payload: FindingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    old_status = finding.status
    new_status = payload.status

    if new_status == old_status:
        raise HTTPException(
            status_code=422,
            detail="Finding already has this status",
        )

    # MVP transitions: Reopened is not an allowed workflow status.
    allowed_transitions = {
        FindingStatus.open: {
            FindingStatus.in_progress,
            FindingStatus.rejected,
            FindingStatus.closed,
        },
        FindingStatus.in_progress: {
            FindingStatus.in_review,
            FindingStatus.rejected,
            FindingStatus.closed,
            FindingStatus.open,
        },
        FindingStatus.in_review: {
            FindingStatus.resolved,
            FindingStatus.closed,
            FindingStatus.rejected,
            FindingStatus.open,
        },
        FindingStatus.reopened: {
            FindingStatus.in_progress,
            FindingStatus.in_review,
            FindingStatus.closed,
            FindingStatus.open,
        },
        FindingStatus.resolved: {
            FindingStatus.closed,
            FindingStatus.rejected,
            FindingStatus.open,
        },
        FindingStatus.rejected: set(),
        FindingStatus.closed: set(),
    }

    if new_status not in allowed_transitions.get(old_status, set()):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Transition from {old_status.value} "
                f"to {new_status.value} is not allowed"
            ),
        )

    # Rejection is exclusively an admin action and requires a reason.
    if new_status == FindingStatus.rejected:
        if current_user.role != UserRole.admin:
            raise HTTPException(
                status_code=403,
                detail="Only admins can reject findings",
            )

        if not payload.reason or not payload.reason.strip():
            raise HTTPException(
                status_code=422,
                detail="A reason is required for Rejected",
            )

    # Developers can start work or submit a fix for review. Only admins
    # can mark a finding Resolved.
    elif current_user.role != UserRole.admin:
        if new_status not in {
            FindingStatus.in_progress,
            FindingStatus.in_review,
        }:
            # Only the assigned reviewer can close a finding.
            if (
                new_status != FindingStatus.closed
                or finding.reviewer_id != current_user.id
            ):
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Only the assigned reviewer or an admin "
                        "can close a finding"
                    ),
                )

    finding.status = new_status
    finding.updated_at = datetime.now(timezone.utc)

    db.add(
        FindingStatusHistory(
            finding_id=finding.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=current_user.id,
            reason=payload.reason.strip() if payload.reason else None,
        )
    )

    db.commit()
    db.refresh(finding)
    return finding


@router.post("/{finding_id}/reassign", response_model=FindingDetailResponse)
def reassign_finding(
    finding_id: uuid.UUID,
    payload: FindingReassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can reassign a finding",
        )

    assignee = get_active_user(payload.assignee_id, db)
    if db.get(ProjectMember, (finding.project_id, assignee.id)) is None:
        raise HTTPException(
            status_code=422,
            detail="Assignee must be a project member",
        )

    old_status = finding.status
    finding.assignee_id = assignee.id
    finding.status = FindingStatus.open
    finding.updated_at = datetime.now(timezone.utc)

    reason_text = (payload.feedback or payload.reason or "").strip()
    hist_reason = f"Reassigned to {assignee.name}" + (f" — {reason_text}" if reason_text else "")

    db.add(
        FindingStatusHistory(
            finding_id=finding.id,
            old_status=old_status,
            new_status=FindingStatus.open,
            changed_by=current_user.id,
            reason=hist_reason,
        )
    )

    if reason_text:
        db.add(
            FindingFeedback(
                finding_id=finding.id,
                author_id=current_user.id,
                body=f"Reassignment note: {reason_text}",
            )
        )

    db.commit()
    db.refresh(finding)
    return finding


@router.get(
    "/{finding_id}/history",
    response_model=list[FindingStatusHistoryResponse],
)
def get_finding_history(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)
    return list(finding.status_history)


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


# ---------------- FINDING FEEDBACK ----------------

@router.post(
    "/{finding_id}/feedback",
    response_model=FindingFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_finding_feedback(
    finding_id: uuid.UUID,
    payload: FindingFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    body = payload.body.strip()
    if not body:
        raise HTTPException(
            status_code=422,
            detail="Feedback body cannot be empty",
        )

    # A reply must belong to the same finding.
    if payload.parent_feedback_id is not None:
        parent = db.scalar(
            select(FindingFeedback).where(
                FindingFeedback.id == payload.parent_feedback_id,
                FindingFeedback.finding_id == finding_id,
            )
        )

        if parent is None:
            raise HTTPException(
                status_code=422,
                detail="Parent feedback must belong to this finding",
            )

    feedback = FindingFeedback(
        finding_id=finding_id,
        author_id=current_user.id,
        parent_feedback_id=payload.parent_feedback_id,
        body=body,
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get(
    "/{finding_id}/feedback",
    response_model=list[FindingFeedbackResponse],
)
def list_finding_feedback(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    query = (
        select(FindingFeedback)
        .where(FindingFeedback.finding_id == finding_id)
        .order_by(FindingFeedback.created_at.asc())
    )

    return db.scalars(query).all()


# ---------------- FINDING WORK HISTORY ----------------

@router.post(
    "/{finding_id}/work-history",
    response_model=FindingWorkHistoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_finding_work_history(
    finding_id: uuid.UUID,
    payload: FindingWorkHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    entry_type = payload.entry_type.strip()
    body = payload.body.strip()

    if not entry_type or not body:
        raise HTTPException(
            status_code=422,
            detail="Entry type and body cannot be empty",
        )

    entry = FindingWorkHistory(
        finding_id=finding_id,
        author_id=current_user.id,
        entry_type=entry_type,
        body=body,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get(
    "/{finding_id}/work-history",
    response_model=list[FindingWorkHistoryResponse],
)
def list_finding_work_history(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    query = (
        select(FindingWorkHistory)
        .where(FindingWorkHistory.finding_id == finding_id)
        .order_by(FindingWorkHistory.created_at.asc())
    )

    return db.scalars(query).all()

# Finding attachments are stored on disk; PostgreSQL stores their metadata.
ATTACHMENT_DIRECTORY = Path(__file__).resolve().parents[3] / "uploads" / "findings"
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024


def attachment_metadata(attachment: FindingAttachment) -> dict:
    uploader_name = None
    uploader_role = None
    if attachment.uploader:
        uploader_name = attachment.uploader.name
        uploader_role = (
            attachment.uploader.role.value
            if hasattr(attachment.uploader.role, "value")
            else str(attachment.uploader.role)
        )
    return {
        "id": str(attachment.id),
        "finding_id": str(attachment.finding_id),
        "original_filename": attachment.original_filename,
        "filename": attachment.original_filename,
        "media_type": attachment.media_type,
        "size_bytes": attachment.size_bytes,
        "attachment_kind": attachment.attachment_kind,
        "uploaded_by": str(attachment.uploaded_by),
        "uploader_name": uploader_name,
        "uploader_role": uploader_role,
        "created_at": attachment.created_at.isoformat() if attachment.created_at else None,
        "download_url": f"/findings/{attachment.finding_id}/attachments/{attachment.id}/download",
    }


@router.post("/{finding_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_finding_attachment(
    finding_id: uuid.UUID,
    file: UploadFile = File(...),
    attachment_kind: str = Form(default="evidence"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Please select a file.")

    original_filename = Path(file.filename.replace("\\", "/")).name.strip()
    if not original_filename:
        original_filename = "attachment"

    if len(original_filename) > 255:
        raise HTTPException(status_code=400, detail="Filename must be 255 characters or fewer.")

    attachment_kind = (attachment_kind or "evidence").strip()[:30] or "evidence"
    content = await file.read(MAX_ATTACHMENT_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Empty files cannot be uploaded.")
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 10 MB upload limit.")

    ATTACHMENT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    storage_key = f"{uuid.uuid4().hex}.bin"
    storage_path = ATTACHMENT_DIRECTORY / storage_key

    try:
        storage_path.write_bytes(content)
        attachment = FindingAttachment(
            finding_id=finding.id,
            uploaded_by=current_user.id,
            original_filename=original_filename,
            storage_key=storage_key,
            media_type=file.content_type or "application/octet-stream",
            size_bytes=len(content),
            attachment_kind=attachment_kind,
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        attachment.uploader = current_user
        return attachment_metadata(attachment)
    except Exception:
        db.rollback()
        storage_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@router.get("/{finding_id}/attachments")
def list_finding_attachments(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    attachments = db.scalars(
        select(FindingAttachment)
        .options(selectinload(FindingAttachment.uploader))
        .where(FindingAttachment.finding_id == finding.id)
        .order_by(FindingAttachment.created_at.asc())
    ).all()
    return [attachment_metadata(item) for item in attachments]


@router.get("/{finding_id}/attachments/{attachment_id}/download")
def download_finding_attachment(
    finding_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    finding = get_active_finding(finding_id, db)
    require_project_access(finding.project_id, current_user, db)

    attachment = db.scalar(
        select(FindingAttachment).where(
            FindingAttachment.id == attachment_id,
            FindingAttachment.finding_id == finding.id,
        )
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    storage_path = ATTACHMENT_DIRECTORY / attachment.storage_key
    if not storage_path.is_file():
        raise HTTPException(status_code=404, detail="The stored attachment file is missing.")

    return FileResponse(
        path=storage_path,
        media_type=attachment.media_type,
        filename=attachment.original_filename,
    )

