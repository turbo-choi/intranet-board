from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.deps import CurrentUser, ensure_board_permission, get_current_user
from app.db.session import get_session
from app.models.attachment import Attachment
from app.models.post import Post
from app.schemas.attachment import AttachmentOut

router = APIRouter(tags=["attachments"])

ALLOWED_EXTENSIONS = {
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "csv",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "zip",
}
MAX_FILE_SIZE = 20 * 1024 * 1024


@router.post("/posts/{post_id}/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    post_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> AttachmentOut:
    post = session.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="write")

    original_name = file.filename or "unnamed"
    extension = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File extension not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 20MB)")

    now = datetime.now(timezone.utc)
    folder = settings.upload_path / str(now.year) / f"{now.month:02d}"
    folder.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid4().hex}.{extension}"
    file_path = folder / stored_name
    file_path.write_bytes(content)

    attachment = Attachment(
        post_id=post.id,
        uploader_id=current_user.id,
        original_name=original_name,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        path=str(file_path),
    )
    session.add(attachment)
    session.commit()
    session.refresh(attachment)

    return AttachmentOut(
        id=attachment.id,
        post_id=attachment.post_id,
        original_name=attachment.original_name,
        mime_type=attachment.mime_type,
        size_bytes=attachment.size_bytes,
        created_at=attachment.created_at,
    )


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    attachment = session.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    post = session.get(Post, attachment.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="read")

    file_path = Path(attachment.path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(path=file_path, filename=attachment.original_name, media_type=attachment.mime_type)
