from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.deps import CurrentUser, can_access_board_by_menu, ensure_board_permission, get_current_user
from app.db.session import get_session
from app.models.board import Board
from app.schemas.board import BoardOut

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=list[BoardOut])
def list_boards(
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[BoardOut]:
    statement = select(Board).order_by(Board.sort_order.asc(), Board.id.asc())
    boards = session.exec(statement).all()

    allowed: list[BoardOut] = []
    for board in boards:
        if not board.is_active and current_user.role_code != "ADMIN":
            continue
        if current_user.role_code != "ADMIN" and not can_access_board_by_menu(
            session,
            board,
            current_user.role_code,
            action="read",
        ):
            continue
        allowed.append(BoardOut(**board.model_dump()))

    return allowed


@router.get("/{board_id}", response_model=BoardOut)
def get_board(
    board_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> BoardOut:
    board = ensure_board_permission(session, board_id, current_user, action="read")
    return BoardOut(**board.model_dump())
