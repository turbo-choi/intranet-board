from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.enums import BoardType


class Board(SQLModel, table=True):
    __tablename__ = "boards"

    id: int | None = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True, max_length=30)
    name: str = Field(max_length=100)
    description: str | None = Field(default=None, max_length=255)
    board_type: str = Field(default=BoardType.GENERAL.value, max_length=20, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    sort_order: int = Field(default=0, nullable=False)
    read_roles: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    write_roles: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
