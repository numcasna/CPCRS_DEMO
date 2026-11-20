import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_project_access
from app.api.routes.findings.shared import get_active_finding
from app.core.media import detect_attachment_media_type
from app.database import get_db
from app.models.entities import FindingAttachment, User

router = APIRouter()

# Finding attachments are stored on disk; PostgreSQL stores their metadata.
ATTACHMENT_DIRECTORY = Path(__file__).resolve().parents[4] / "uploads" / "findings"
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

    detected_media_type = detect_attachment_media_type(
        content,
        original_filename,
        file.content_type,
    )

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
            media_type=detected_media_type,
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
