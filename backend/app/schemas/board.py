from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class BoardBase(BaseModel):
    key: str
    name: str
    description: str | None = None
    sort_order: int = 0


class BoardCreate(BoardBase):
    read_roles: list[str] | None = None
    write_roles: list[str] | None = None


class BoardUpdate(BaseModel):
    key: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    read_roles: list[str] | None = None
    write_roles: list[str] | None = None


class BoardOut(BoardBase):
    id: int
    read_roles: list[str]
    write_roles: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
