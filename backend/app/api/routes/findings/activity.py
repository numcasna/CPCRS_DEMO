import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_project_access
from app.api.routes.findings.shared import get_active_finding
from app.database import get_db
from app.models.entities import FindingFeedback, FindingWorkHistory, User
from app.schemas.finding_activity import (
    FindingFeedbackCreate,
    FindingFeedbackResponse,
    FindingWorkHistoryCreate,
    FindingWorkHistoryResponse,
)

router = APIRouter()


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
