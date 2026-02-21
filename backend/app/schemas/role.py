from __future__ import annotations

from pydantic import BaseModel, Field


class RoleMatrixRole(BaseModel):
    role_code: str
    role_name: str
    system_permissions: list[str]


class RoleMatrixBoard(BaseModel):
    board_id: int
    board_key: str
    board_name: str
    read_roles: list[str]
    write_roles: list[str]


class RoleMatrixMenu(BaseModel):
    menu_id: int
    menu_name: str
    menu_path: str
    parent_id: int | None = None
    category_name: str | None = None
    board_id: int | None = None
    read_roles: list[str]
    write_roles: list[str]


class RoleMatrixResponse(BaseModel):
    roles: list[RoleMatrixRole]
    menus: list[RoleMatrixMenu] = Field(default_factory=list)
    boards: list[RoleMatrixBoard] = Field(default_factory=list)


class RoleMatrixUpdate(BaseModel):
    roles: list[RoleMatrixRole]
    menus: list[RoleMatrixMenu] = Field(default_factory=list)
    boards: list[RoleMatrixBoard] = Field(default_factory=list)
