import secrets
from pathlib import Path

from fastapi import UploadFile

from app.core.exceptions import ValidationFailedError

UPLOAD_DIR = Path("/app/uploads")
PUBLIC_PREFIX = "/uploads"

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


async def _save_image(file: UploadFile, subdir: str) -> str:
    ext = ALLOWED_CONTENT_TYPES.get(file.content_type or "")
    if ext is None:
        raise ValidationFailedError(
            "Unsupported image type. Use JPG, PNG, WEBP, or GIF."
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise ValidationFailedError("Image must be 5 MB or smaller")
    if not data:
        raise ValidationFailedError("Empty file")

    target_dir = UPLOAD_DIR / subdir if subdir else UPLOAD_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{secrets.token_urlsafe(16)}{ext}"
    (target_dir / filename).write_bytes(data)
    path_suffix = f"{subdir}/{filename}" if subdir else filename
    return f"{PUBLIC_PREFIX}/{path_suffix}"


async def save_product_image(file: UploadFile) -> str:
    return await _save_image(file, subdir="")


async def save_avatar_image(file: UploadFile) -> str:
    return await _save_image(file, subdir="avatars")
