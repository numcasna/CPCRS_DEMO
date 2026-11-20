
import base64
import binascii
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin
from app.config import settings
from app.core.media import detect_image_media_type
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.entities import User
from app.schemas.auth import (
    AvatarUploadRequest,
    ChangePasswordRequest,
    CreateUserRequest,
    TokenResponse,
    UserResponse,
    LoginRequest,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])
AVATAR_DIRECTORY = Path(__file__).resolve().parents[3] / "uploads" / "avatars"
AVATAR_DIRECTORY.mkdir(parents=True, exist_ok=True)


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower()

    user = db.scalar(
        select(User).where(func.lower(User.email) == email)
    )

    # Use the same response for an unknown email and a wrong password.
    if (
        user is None
        or not verify_password(data.password, user.password_hash)
        or not user.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.password_hash = hash_password(data.new_password)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"ok": True, "message": "Password changed successfully."}


@router.post("/avatar")
def upload_avatar(
    data: AvatarUploadRequest,
    current_user: User = Depends(get_current_user),
):
    raw_str = data.avatar.strip()
    if raw_str.startswith("data:"):
        if ";base64," not in raw_str:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        header, b64_data = raw_str.split(";base64,", 1)
        if not header.lower().startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Only image data URLs are supported")
        payload = "".join(b64_data.split())
    else:
        payload = "".join(raw_str.split())

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid base64 image encoding")

    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar image size cannot exceed 5MB")

    if detect_image_media_type(image_bytes, require_png_ihdr=True) is None:
        raise HTTPException(status_code=400, detail="Unsupported or corrupt image. Please upload a valid PNG, JPG, GIF, or WebP file.")

    avatar_path = AVATAR_DIRECTORY / f"{current_user.id}.png"
    avatar_path.write_bytes(image_bytes)

    version = avatar_path.stat().st_mtime_ns // 1_000_000
    avatar_url = f"{settings.base_url.rstrip('/')}/auth/avatar/{current_user.id}?v={version}"
    return {"ok": True, "avatar": avatar_url}


@router.get("/avatar/{user_id}")
def get_avatar(user_id: str):
    try:
        parsed_id = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    avatar_path = AVATAR_DIRECTORY / f"{parsed_id}.png"
    if not avatar_path.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")

    with avatar_path.open("rb") as fh:
        header = fh.read(32)
    media_type = detect_image_media_type(header) or "image/png"

    return FileResponse(
        avatar_path,
        media_type=media_type,
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    email = str(data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(func.lower(User.email) == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    return user
