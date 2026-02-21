from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_locked: bool
    is_active: bool
    created_at: datetime


class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int


class UserRoleUpdate(BaseModel):
    role_code: str


class UserLockUpdate(BaseModel):
    is_locked: bool
