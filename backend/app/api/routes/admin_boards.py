from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.deps import CurrentUser, require_roles
from app.db.session import get_session
from app.models.board import Board
from app.schemas.board import BoardCreate, BoardOut, BoardUpdate

router = APIRouter(prefix="/admin/boards", tags=["admin-boards"])
ALLOWED_ROLE_CODES = {"ADMIN", "MANAGER", "USER"}


def _validate_role_set(read_roles: list[str], write_roles: list[str]) -> None:
    invalid_read = set(read_roles) - ALLOWED_ROLE_CODES
    invalid_write = set(write_roles) - ALLOWED_ROLE_CODES
    if invalid_read or invalid_write:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role code in read/write roles")


@router.get("", response_model=list[BoardOut])
def list_admin_boards(
    include_inactive: bool = Query(default=True),
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> list[BoardOut]:
    statement = select(Board).order_by(Board.sort_order.asc(), Board.id.asc())
    if not include_inactive:
        statement = statement.where(Board.is_active == True)
    boards = session.exec(statement).all()
    return [BoardOut(**board.model_dump()) for board in boards]


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def create_board(
    payload: BoardCreate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> BoardOut:
    read_roles = payload.read_roles or ["USER", "MANAGER", "ADMIN"]
    write_roles = payload.write_roles or ["MANAGER", "ADMIN"]
    _validate_role_set(read_roles, write_roles)

    exists = session.exec(select(Board).where(Board.key == payload.key)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Board key already exists")

    board = Board(**payload.model_dump(exclude={"read_roles", "write_roles"}), read_roles=read_roles, write_roles=write_roles, is_active=True)
    session.add(board)
    session.commit()
    session.refresh(board)
    return BoardOut(**board.model_dump())


@router.patch("/{board_id}", response_model=BoardOut)
def update_board(
    board_id: int,
    payload: BoardUpdate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> BoardOut:
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    updates = payload.model_dump(exclude_unset=True)
    next_read_roles = updates.get("read_roles", board.read_roles)
    next_write_roles = updates.get("write_roles", board.write_roles)
    _validate_role_set(next_read_roles, next_write_roles)

    if "key" in updates and updates["key"] != board.key:
        duplicate = session.exec(select(Board).where(Board.key == updates["key"])).first()
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Board key already exists")

    for key, value in updates.items():
        setattr(board, key, value)
    board.updated_at = datetime.now(timezone.utc)

    session.add(board)
    session.commit()
    session.refresh(board)
    return BoardOut(**board.model_dump())


@router.delete("/{board_id}")
def deactivate_board(
    board_id: int,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> dict[str, str]:
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    board.is_active = False
    board.updated_at = datetime.now(timezone.utc)
    session.add(board)
    session.commit()
    return {"message": "Board deactivated"}
