from __future__ import annotations

from enum import Enum


class StrEnum(str, Enum):
    pass


class RoleCode(StrEnum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    USER = "USER"


class QnaStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    ANSWERED = "ANSWERED"


class SystemPermission(StrEnum):
    MANAGE_BOARDS = "MANAGE_BOARDS"
    MANAGE_MENUS = "MANAGE_MENUS"
    MANAGE_USERS = "MANAGE_USERS"
    MANAGE_ROLES = "MANAGE_ROLES"
    MODERATE_CONTENT = "MODERATE_CONTENT"
