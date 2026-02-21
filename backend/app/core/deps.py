from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.core.security import TokenError, decode_token
from app.db.session import get_session
from app.models.board import Board
from app.models.menu import Menu
from app.models.menu_permission import MenuPermission
from app.models.role import Role
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
CATEGORY_PATH = "__category__"


@dataclass
class CurrentUser:
    id: int
    username: str
    email: str
    role_code: str
    role_name: str
    is_locked: bool
    is_active: bool


def _load_current_user(session: Session, user_id: int) -> CurrentUser:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    role = session.get(Role, user.role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Role not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    return CurrentUser(
        id=user.id,
        username=user.username,
        email=user.email,
        role_code=role.code,
        role_name=role.name,
        is_locked=user.is_locked,
        is_active=user.is_active,
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> CurrentUser:
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    current_user = _load_current_user(session, int(subject))
    if current_user.is_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is locked")

    return current_user


def require_roles(*allowed_roles: str):
    def _checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role_code not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return _checker


def has_admin_privilege(current_user: CurrentUser) -> bool:
    return current_user.role_code in {"ADMIN", "MANAGER"}


def _active_board_menu_ids(session: Session, board_id: int) -> list[int]:
    ids = session.exec(
        select(Menu.id)
        .where(Menu.board_id == board_id)
        .where(Menu.is_active == True)
        .where(Menu.path != CATEGORY_PATH)
    ).all()
    return [int(menu_id) for menu_id in ids]


def _role_menu_permissions(session: Session, menu_ids: list[int], role_code: str) -> list[MenuPermission]:
    if not menu_ids:
        return []
    return session.exec(
        select(MenuPermission)
        .where(MenuPermission.menu_id.in_(menu_ids))
        .where(MenuPermission.role_code == role_code)
    ).all()


def can_access_menu(
    session: Session,
    menu: Menu,
    role_code: str,
    action: str = "read",
) -> bool:
    if role_code == "ADMIN":
        return True

    if menu.path == CATEGORY_PATH or not menu.is_active:
        return False

    perm = session.exec(
        select(MenuPermission)
        .where(MenuPermission.menu_id == menu.id)
        .where(MenuPermission.role_code == role_code)
    ).first()
    if perm:
        if action == "write":
            return perm.can_write
        return perm.can_read or perm.can_write

    # Backward-compatible fallback for board-linked menus.
    if menu.board_id:
        board = session.get(Board, menu.board_id)
        if board and board.is_active:
            target_roles = board.read_roles if action == "read" else board.write_roles
            return role_code in set(target_roles or [])

    # Default deny for non-admin when no explicit menu permission exists.
    return False


def can_access_board(board: Board, role_code: str, action: str) -> bool:
    target_roles = board.read_roles if action == "read" else board.write_roles
    return role_code in set(target_roles or [])


def can_access_board_by_menu(
    session: Session,
    board: Board,
    role_code: str,
    action: str,
) -> bool:
    if role_code == "ADMIN":
        return True

    menu_ids = _active_board_menu_ids(session, board.id)
    if menu_ids:
        permissions = _role_menu_permissions(session, menu_ids, role_code)
        if permissions:
            if action == "write":
                return any(item.can_write for item in permissions)
            return any(item.can_read or item.can_write for item in permissions)

    # Backward-compatible fallback for legacy data without menu permission rows.
    return can_access_board(board, role_code, action=action)


def ensure_board_permission(
    session: Session,
    board_id: int,
    current_user: CurrentUser,
    action: str = "read",
) -> Board:
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    if not board.is_active and current_user.role_code != "ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not available")

    if current_user.role_code == "ADMIN":
        return board

    if not can_access_board_by_menu(session, board, current_user.role_code, action=action):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Board permission denied")

    return board


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_role_by_code(session: Session, role_code: str) -> Role | None:
    statement = select(Role).where(Role.code == role_code)
    return session.exec(statement).first()
