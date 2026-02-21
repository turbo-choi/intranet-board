from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Attachment(SQLModel, table=True):
    __tablename__ = "attachments"

    id: int | None = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="posts.id", index=True)
    uploader_id: int = Field(foreign_key="users.id", index=True)
    original_name: str = Field(max_length=255)
    stored_name: str = Field(max_length=255)
    mime_type: str = Field(max_length=120)
    size_bytes: int = Field(nullable=False)
    path: str = Field(max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
