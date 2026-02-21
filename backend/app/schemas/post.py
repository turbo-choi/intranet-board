from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AttachmentMeta(BaseModel):
    id: int
    original_name: str
    mime_type: str
    size_bytes: int
    created_at: datetime


class PostCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False
    qna_status: str | None = None


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_pinned: bool | None = None
    qna_status: str | None = None


class PostOut(BaseModel):
    id: int
    board_id: int
    title: str
    content: str
    author_id: int
    author_name: str
    is_pinned: bool
    is_deleted: bool
    view_count: int
    like_count: int
    comment_count: int
    liked_by_me: bool
    qna_status: str | None
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentMeta]


class PostListItem(BaseModel):
    id: int
    board_id: int
    title: str
    author_id: int
    author_name: str
    is_pinned: bool
    is_deleted: bool
    view_count: int
    like_count: int
    comment_count: int
    liked_by_me: bool
    qna_status: str | None
    created_at: datetime


class PostListResponse(BaseModel):
    items: list[PostListItem]
    total: int
    page: int
    page_size: int
