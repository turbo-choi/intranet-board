from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

from app.core.deps import CurrentUser, ensure_board_permission, get_current_user
from app.db.session import get_session
from app.models.like import PostLike
from app.models.post import Post
from app.schemas.like import LikeStatusOut

router = APIRouter(prefix="/posts", tags=["likes"])


def _load_post_for_like(session: Session, post_id: int, current_user: CurrentUser) -> Post:
    post = session.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="read")
    return post


def _count_likes(session: Session, post_id: int) -> int:
    return int(
        session.exec(
            select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)
        ).one()
    )


@router.get("/{post_id}/like", response_model=LikeStatusOut)
def get_like_status(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> LikeStatusOut:
    _load_post_for_like(session, post_id, current_user)

    liked = session.exec(
        select(PostLike)
        .where(PostLike.post_id == post_id)
        .where(PostLike.user_id == current_user.id)
    ).first()

    return LikeStatusOut(liked=liked is not None, like_count=_count_likes(session, post_id))


@router.post("/{post_id}/like", response_model=LikeStatusOut)
def toggle_like(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> LikeStatusOut:
    _load_post_for_like(session, post_id, current_user)

    existing = session.exec(
        select(PostLike)
        .where(PostLike.post_id == post_id)
        .where(PostLike.user_id == current_user.id)
    ).first()

    liked: bool
    if existing:
        session.delete(existing)
        liked = False
    else:
        session.add(PostLike(post_id=post_id, user_id=current_user.id))
        liked = True

    session.commit()

    return LikeStatusOut(liked=liked, like_count=_count_likes(session, post_id))
