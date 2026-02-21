from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app.core.deps import CurrentUser, can_access_board_by_menu, get_current_user
from app.db.session import get_session
from app.models.board import Board
from app.models.post import Post

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, int]:
    board_conditions = [Board.is_active == True]
    post_conditions = [Post.is_deleted == False]

    if current_user.role_code != "ADMIN":
        boards = session.exec(select(Board).where(*board_conditions)).all()
        readable_board_ids = [
            board.id
            for board in boards
            if can_access_board_by_menu(session, board, current_user.role_code, action="read")
        ]
        board_count = len(readable_board_ids)
        if readable_board_ids:
            post_count = session.exec(
                select(func.count())
                .select_from(Post)
                .where(*post_conditions)
                .where(Post.board_id.in_(readable_board_ids))
            ).one()
        else:
            post_count = 0
        return {"board_count": board_count, "post_count": post_count}

    board_count = session.exec(select(func.count()).select_from(Board)).one()
    post_count = session.exec(select(func.count()).select_from(Post).where(Post.is_deleted == False)).one()
    return {"board_count": board_count, "post_count": post_count}
