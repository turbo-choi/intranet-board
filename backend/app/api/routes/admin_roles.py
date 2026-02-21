from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.deps import CurrentUser, require_roles
from app.db.session import get_session
from app.models.board import Board
from app.models.menu import Menu
from app.models.menu_permission import MenuPermission
from app.models.role import Role
from app.schemas.role import RoleMatrixBoard, RoleMatrixMenu, RoleMatrixResponse, RoleMatrixRole, RoleMatrixUpdate

router = APIRouter(prefix="/admin/roles", tags=["admin-roles"])
CATEGORY_PATH = "__category__"


def _role_order_map(roles: list[Role]) -> dict[str, int]:
    return {role.code: index for index, role in enumerate(roles)}


def _sorted_role_codes(values: set[str], order_map: dict[str, int]) -> list[str]:
    return sorted(values, key=lambda code: order_map.get(code, 9999))


def _build_menu_matrix(session: Session, roles: list[Role]) -> list[RoleMatrixMenu]:
    order_map = _role_order_map(roles)
    menus = session.exec(select(Menu).where(Menu.is_active == True).order_by(Menu.sort_order.asc(), Menu.id.asc())).all()
    category_map = {menu.id: menu.name for menu in menus if menu.path == CATEGORY_PATH}
    menu_items = [menu for menu in menus if menu.path != CATEGORY_PATH]
    menu_ids = [menu.id for menu in menu_items]

    role_codes = {role.code for role in roles}
    read_map: dict[int, set[str]] = {menu_id: set() for menu_id in menu_ids}
    write_map: dict[int, set[str]] = {menu_id: set() for menu_id in menu_ids}
    has_explicit_perm: dict[int, bool] = {menu_id: False for menu_id in menu_ids}

    if menu_ids:
        permissions = session.exec(select(MenuPermission).where(MenuPermission.menu_id.in_(menu_ids))).all()
        for permission in permissions:
            if permission.role_code not in role_codes:
                continue
            has_explicit_perm[permission.menu_id] = True
            if permission.can_read:
                read_map.setdefault(permission.menu_id, set()).add(permission.role_code)
            if permission.can_write:
                write_map.setdefault(permission.menu_id, set()).add(permission.role_code)

    board_ids = list({menu.board_id for menu in menu_items if menu.board_id is not None})
    board_map = {}
    if board_ids:
        board_rows = session.exec(select(Board).where(Board.id.in_(board_ids))).all()
        board_map = {board.id: board for board in board_rows}

    matrix: list[RoleMatrixMenu] = []
    for menu in menu_items:
        read_roles = read_map.get(menu.id, set())
        write_roles = write_map.get(menu.id, set())

        if not has_explicit_perm.get(menu.id, False):
            if menu.board_id and menu.board_id in board_map:
                board = board_map[menu.board_id]
                read_roles = set(board.read_roles or [])
                write_roles = set(board.write_roles or [])
            elif menu.path.startswith("/admin"):
                read_roles = {"ADMIN"}
                write_roles = {"ADMIN"}

        matrix.append(
            RoleMatrixMenu(
                menu_id=menu.id,
                menu_name=menu.name,
                menu_path=menu.path,
                parent_id=menu.parent_id,
                category_name=category_map.get(menu.parent_id),
                board_id=menu.board_id,
                read_roles=_sorted_role_codes(read_roles, order_map),
                write_roles=_sorted_role_codes(write_roles, order_map),
            )
        )

    return matrix


def _sync_boards_from_menu_permissions(session: Session, roles: list[Role]) -> None:
    menus = session.exec(select(Menu).where(Menu.path != CATEGORY_PATH).where(Menu.board_id.is_not(None))).all()
    if not menus:
        return

    role_codes = {role.code for role in roles}
    menu_ids = [menu.id for menu in menus]
    board_ids_with_menu = {menu.board_id for menu in menus if menu.board_id is not None}
    menu_by_id = {menu.id: menu for menu in menus}

    read_by_board: dict[int, set[str]] = {int(board_id): set() for board_id in board_ids_with_menu}
    write_by_board: dict[int, set[str]] = {int(board_id): set() for board_id in board_ids_with_menu}

    permissions = session.exec(select(MenuPermission).where(MenuPermission.menu_id.in_(menu_ids))).all()
    for permission in permissions:
        if permission.role_code not in role_codes:
            continue
        menu = menu_by_id.get(permission.menu_id)
        if not menu or menu.board_id is None:
            continue

        board_id = int(menu.board_id)
        if permission.can_read or permission.can_write:
            read_by_board.setdefault(board_id, set()).add(permission.role_code)
        if permission.can_write:
            write_by_board.setdefault(board_id, set()).add(permission.role_code)

    order_map = _role_order_map(roles)
    boards = session.exec(select(Board).where(Board.id.in_(list(board_ids_with_menu)))).all()
    for board in boards:
        board.read_roles = _sorted_role_codes(read_by_board.get(board.id, set()), order_map)
        board.write_roles = _sorted_role_codes(write_by_board.get(board.id, set()), order_map)
        board.updated_at = datetime.now(timezone.utc)
        session.add(board)


@router.get("/matrix", response_model=RoleMatrixResponse)
def get_role_matrix(
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> RoleMatrixResponse:
    roles = session.exec(select(Role).order_by(Role.id.asc())).all()
    boards = session.exec(select(Board).order_by(Board.sort_order.asc(), Board.id.asc())).all()
    menus = _build_menu_matrix(session, roles)

    return RoleMatrixResponse(
        roles=[
            RoleMatrixRole(
                role_code=role.code,
                role_name=role.name,
                system_permissions=role.system_permissions,
            )
            for role in roles
        ],
        menus=menus,
        boards=[
            RoleMatrixBoard(
                board_id=board.id,
                board_key=board.key,
                board_name=board.name,
                read_roles=board.read_roles,
                write_roles=board.write_roles,
            )
            for board in boards
        ],
    )


@router.put("/matrix", response_model=RoleMatrixResponse)
def update_role_matrix(
    payload: RoleMatrixUpdate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> RoleMatrixResponse:
    roles = session.exec(select(Role).order_by(Role.id.asc())).all()
    role_map = {role.code: role for role in roles}
    valid_role_codes = set(role_map.keys())

    for role_payload in payload.roles:
        role = role_map.get(role_payload.role_code)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role {role_payload.role_code} not found",
            )
        role.name = role_payload.role_name
        role.system_permissions = sorted(set(role_payload.system_permissions))
        role.updated_at = datetime.now(timezone.utc)
        session.add(role)

    if payload.menus:
        menu_ids = [menu_payload.menu_id for menu_payload in payload.menus]
        menus = session.exec(select(Menu).where(Menu.id.in_(menu_ids))).all()
        menu_map = {menu.id: menu for menu in menus}

        for menu_payload in payload.menus:
            menu = menu_map.get(menu_payload.menu_id)
            if not menu:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Menu {menu_payload.menu_id} not found",
                )
            if menu.path == CATEGORY_PATH:
                continue

            read_set = set(menu_payload.read_roles) & valid_role_codes
            write_set = set(menu_payload.write_roles) & valid_role_codes
            existing_permissions = session.exec(
                select(MenuPermission).where(MenuPermission.menu_id == menu.id)
            ).all()
            existing_map = {permission.role_code: permission for permission in existing_permissions}

            for role_code in valid_role_codes:
                should_read = role_code in read_set
                should_write = role_code in write_set
                permission = existing_map.get(role_code)

                if should_read or should_write:
                    if not permission:
                        permission = MenuPermission(menu_id=menu.id, role_code=role_code)
                    permission.can_read = should_read
                    permission.can_write = should_write
                    permission.updated_at = datetime.now(timezone.utc)
                    session.add(permission)
                elif permission:
                    session.delete(permission)

        _sync_boards_from_menu_permissions(session, roles)

    # Backward compatibility:
    # apply board-level payload only when menu matrix is not being updated.
    if not payload.menus:
        for board_payload in payload.boards:
            board = session.get(Board, board_payload.board_id)
            if not board:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Board {board_payload.board_id} not found",
                )
            board.read_roles = sorted(set(board_payload.read_roles) & valid_role_codes)
            board.write_roles = sorted(set(board_payload.write_roles) & valid_role_codes)
            board.updated_at = datetime.now(timezone.utc)
            session.add(board)

    session.commit()
    return get_role_matrix(session=session)
