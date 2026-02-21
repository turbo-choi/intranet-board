from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Menu(SQLModel, table=True):
    __tablename__ = "menus"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    path: str = Field(max_length=200)
    icon: str | None = Field(default=None, max_length=50)
    parent_id: int | None = Field(default=None, foreign_key="menus.id", index=True)
    board_id: int | None = Field(default=None, foreign_key="boards.id", index=True)
    sort_order: int = Field(default=0, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
