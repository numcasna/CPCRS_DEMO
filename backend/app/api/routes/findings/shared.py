import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_active_user
from app.models.entities import Finding, FindingCodeCounter, ProjectMember, User


def get_active_finding(
    finding_id: uuid.UUID,
    db: Session,
) -> Finding:
    """Return a non-deleted finding with status history or raise 404."""
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


def get_project_member_user(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session,
    non_member_detail: str,
) -> User:
    """Validate that user_id is active (422 if not) and belongs to project_id."""
    user = get_active_user(user_id, db, not_found_status=422)
    if db.get(ProjectMember, (project_id, user.id)) is None:
        raise HTTPException(status_code=422, detail=non_member_detail)
    return user


def generate_finding_code(db: Session) -> str:
    """Atomically increment and format the yearly finding sequence code."""
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
