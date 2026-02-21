from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Post(SQLModel, table=True):
    __tablename__ = "posts"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id", index=True)
    title: str = Field(max_length=255)
    content: str
    author_id: int = Field(foreign_key="users.id", index=True)
    is_pinned: bool = Field(default=False, nullable=False)
    is_deleted: bool = Field(default=False, nullable=False)
    view_count: int = Field(default=0, nullable=False)
    qna_status: str | None = Field(default=None, max_length=30)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at: datetime | None = Field(default=None)
