
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

#from app.api.dependencies import require_admin
from app.api.dependencies import get_current_user, require_admin
from app.database import get_db
from app.models.entities import User, UserRole
from app.schemas.auth import UserResponse

from datetime import date
from app.models.entities import (
    Finding,
    FindingStatus,
    FindingStatusHistory,
    FindingWorkHistory,
    FindingFeedback,
    FindingAttachment,
)


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/available-for-project", response_model=list[UserResponse])
def list_users_available_for_project(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active accounts for selecting project members."""
    statement = (
        select(User)
        .where(User.is_active.is_(True))
        .order_by(User.name)
    )
    return db.scalars(statement).all()


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Allow admins to view all active users."""
    statement = (
        select(User)
        .where(User.is_active.is_(True))
        .order_by(User.name)
    )
    return db.scalars(statement).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow authenticated users to view an individual user's profile."""
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.is_active.is_(True),
        )
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user

@router.get("/{user_id}/contributions")
def get_user_contributions(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Confirm that the developer exists.
    developer = db.scalar(
        select(User).where(User.id == user_id)
    )

    if developer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 2. Load all findings, including findings from past projects.
    # Soft-deleted findings are excluded from current workload counts.
    findings = db.scalars(
        select(Finding)
    ).all()

    # Keep a lookup so activity entries can identify their findings.
    finding_by_id = {finding.id: finding for finding in findings}

    # 3. Calculate the developer's current assigned workload.
    assigned = [
        finding
        for finding in findings
        if finding.assignee_id == user_id
    ]

    status_counts = {
        finding_status.value: sum(
            finding.status == finding_status
            for finding in assigned
        )
        for finding_status in FindingStatus
    }

    active_statuses = {
        FindingStatus.open,
        FindingStatus.in_progress,
        FindingStatus.reopened,
    }

    overdue = [
        finding
        for finding in assigned
        if finding.status in active_statuses
        and finding.due_date is not None
        and finding.due_date < date.today()
    ]

    # 4. Find resolution events performed by this developer.
    resolution_history = db.scalars(
        select(FindingStatusHistory)
        .where(
            FindingStatusHistory.changed_by == user_id,
            FindingStatusHistory.new_status == FindingStatus.resolved,
        )
        .order_by(FindingStatusHistory.changed_at.desc())
    ).all()

    resolution_events = []

    for event in resolution_history:
        finding = finding_by_id.get(event.finding_id)

        # Ignore soft-deleted findings in this initial version.
        if finding is None:
            continue

        duration_seconds = (
            event.changed_at - finding.created_at
        ).total_seconds()

        resolution_events.append({
            "finding_id": str(finding.id),
            "finding_code": finding.finding_code,
            "title": finding.title,
            "resolved_at": event.changed_at,
            "created_at": finding.created_at,
            "resolution_time_seconds": max(
                0, int(duration_seconds)
            ),
            "resolution_time_days": round(
                max(0, duration_seconds) / 86400, 2
            ),
        })

    unique_resolved_ids = {
        event["finding_id"] for event in resolution_events
    }

    # 5. Collect work-history entries written by this developer.
    work_entries = db.scalars(
        select(FindingWorkHistory)
        .where(FindingWorkHistory.author_id == user_id)
        .order_by(FindingWorkHistory.created_at.desc())
    ).all()

    # 6. Collect feedback written by this developer.
    feedback_entries = db.scalars(
        select(FindingFeedback)
        .where(FindingFeedback.author_id == user_id)
        .order_by(FindingFeedback.created_at.desc())
    ).all()

    # 7. Collect attachments uploaded by this developer.
    attachment_entries = db.scalars(
        select(FindingAttachment)
        .where(FindingAttachment.uploaded_by == user_id)
        .order_by(FindingAttachment.created_at.desc())
    ).all()

    def finding_reference(finding_id):
        finding = finding_by_id.get(finding_id)

        if finding is None:
            return {
                "finding_id": str(finding_id),
                "finding_code": None,
                "title": "Finding unavailable",
            }

        return {
            "finding_id": str(finding.id),
            "finding_code": finding.finding_code,
            "title": finding.title,
        }

    # 8. Combine the activity into one chronological timeline.
    timeline = []

    for event in db.scalars(
        select(FindingStatusHistory)
        .where(FindingStatusHistory.changed_by == user_id)
    ).all():
        timeline.append({
            "type": "status_change",
            **finding_reference(event.finding_id),
            "timestamp": event.changed_at,
            "old_status": (
                event.old_status.value
                if event.old_status else None
            ),
            "new_status": event.new_status.value,
            "reason": event.reason,
        })

    for entry in work_entries:
        timeline.append({
            "type": "work_history",
            **finding_reference(entry.finding_id),
            "timestamp": entry.created_at,
            "entry_type": entry.entry_type,
            "body": entry.body,
        })

    for entry in feedback_entries:
        timeline.append({
            "type": "feedback",
            **finding_reference(entry.finding_id),
            "timestamp": entry.created_at,
            "body": entry.body,
        })

    for entry in attachment_entries:
        timeline.append({
            "type": "attachment",
            **finding_reference(entry.finding_id),
            "timestamp": entry.created_at,
            "filename": entry.original_filename,
            "attachment_kind": entry.attachment_kind,
            "size_bytes": entry.size_bytes,
        })

    timeline.sort(
        key=lambda item: item["timestamp"],
        reverse=True,
    )

    # 9. Return the contribution report.
    return {
        "developer": {
            "id": str(developer.id),
            "name": developer.name,
            "email": developer.email,
            "role": developer.role.value,
        },
        "workload": {
            "currently_assigned": len(assigned),
            "overdue": len(overdue),
            "status_counts": status_counts,
            "overdue_findings": [
                {
                    **finding_reference(finding.id),
                    "due_date": finding.due_date,
                    "status": finding.status.value,
                }
                for finding in overdue
            ],
        },
        "resolution_summary": {
            "unique_findings_resolved": len(unique_resolved_ids),
            "resolution_events": len(resolution_events),
            "events": resolution_events,
        },
        "timeline": timeline,
    }