from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AttachmentOut(BaseModel):
    id: int
    post_id: int
    original_name: str
    mime_type: str
    size_bytes: int
    created_at: datetime
