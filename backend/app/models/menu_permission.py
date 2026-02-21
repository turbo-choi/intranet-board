from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class MenuPermission(SQLModel, table=True):
    __tablename__ = "menu_permissions"
    __table_args__ = (UniqueConstraint("menu_id", "role_code", name="uq_menu_permission_menu_role"),)

    id: int | None = Field(default=None, primary_key=True)
    menu_id: int = Field(foreign_key="menus.id", index=True)
    role_code: str = Field(max_length=20, index=True)
    can_read: bool = Field(default=True, nullable=False)
    can_write: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
