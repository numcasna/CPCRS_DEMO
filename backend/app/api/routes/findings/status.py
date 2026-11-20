import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_project_access
from app.api.routes.findings.shared import get_active_finding, get_project_member_user
from app.database import get_db
from app.models.entities import (
    FindingFeedback,
    FindingStatus,
    FindingStatusHistory,
    User,
    UserRole,
)
from app.schemas.findings import (
    FindingDetailResponse,
    FindingReassignRequest,
    FindingResponse,
    FindingStatusHistoryResponse,
    FindingStatusUpdate,
)

router = APIRouter()

ALLOWED_TRANSITIONS = {
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

    if new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
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

    assignee = get_project_member_user(
        finding.project_id,
        payload.assignee_id,
        db,
        "Assignee must be a project member",
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
