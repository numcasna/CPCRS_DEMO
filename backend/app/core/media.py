from pathlib import Path

_TEXT_EXTENSIONS = {
    ".txt",
    ".log",
    ".md",
    ".csv",
    ".json",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".yml",
    ".yaml",
    ".xml",
    ".sql",
}


def detect_image_media_type(
    image_bytes: bytes,
    *,
    require_png_ihdr: bool = False,
) -> str | None:
    """Detect supported raster image MIME types from magic bytes."""
    if len(image_bytes) >= 8 and image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        if not require_png_ihdr or (len(image_bytes) >= 16 and image_bytes[12:16] == b"IHDR"):
            return "image/png"
    if len(image_bytes) >= 3 and image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(image_bytes) >= 6 and image_bytes.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if (
        len(image_bytes) >= 12
        and image_bytes[:4] == b"RIFF"
        and image_bytes[8:12] == b"WEBP"
    ):
        return "image/webp"
    return None


def detect_attachment_media_type(
    content: bytes,
    filename: str,
    declared_content_type: str | None = None,
) -> str:
    """Infer a safe MIME type from file bytes instead of trusting client headers."""
    image_type = detect_image_media_type(content)
    if image_type is not None:
        return image_type

    if content.startswith(b"%PDF-"):
        return "application/pdf"

    ext = Path(filename).suffix.lower()

    if content.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")):
        office_zip_types = {
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
        return office_zip_types.get(ext, "application/zip")

    if content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "application/msword" if ext == ".doc" else "application/octet-stream"

    is_declared_text = bool(declared_content_type and declared_content_type.startswith("text/"))
    if (ext in _TEXT_EXTENSIONS or is_declared_text) and b"\x00" not in content:
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            return "application/octet-stream"
        text_types = {
            ".json": "application/json",
            ".csv": "text/csv",
            ".md": "text/markdown",
        }
        return text_types.get(ext, "text/plain")

    return "application/octet-stream"
