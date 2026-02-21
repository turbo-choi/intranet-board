from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    post_id: int
    author_id: int
    author_name: str
    content: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
