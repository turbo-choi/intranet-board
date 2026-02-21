from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class MenuBase(BaseModel):
    name: str
    path: str
    icon: str | None = None
    parent_id: int | None = None
    board_id: int | None = None
    sort_order: int = 0
    is_active: bool = True


class MenuCreate(MenuBase):
    pass


class MenuUpdate(BaseModel):
    name: str | None = None
    path: str | None = None
    icon: str | None = None
    parent_id: int | None = None
    board_id: int | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class MenuReorderItem(BaseModel):
    id: int
    sort_order: int


class MenuOut(MenuBase):
    id: int
    created_at: datetime
    updated_at: datetime
