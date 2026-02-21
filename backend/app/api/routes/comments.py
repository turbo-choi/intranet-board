from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.deps import CurrentUser, ensure_board_permission, get_current_user, has_admin_privilege
from app.db.session import get_session
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(tags=["comments"])


def _comment_out(comment: Comment, author_name: str) -> CommentOut:
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        author_id=comment.author_id,
        author_name=author_name,
        content=comment.content,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
def list_comments(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[CommentOut]:
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="read")
    if post.is_deleted and current_user.role_code != "ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    statement = select(Comment).where(Comment.post_id == post_id)
    if current_user.role_code != "ADMIN":
        statement = statement.where(Comment.is_deleted == False)
    statement = statement.order_by(Comment.created_at.asc())

    comments = session.exec(statement).all()
    user_ids = [comment.author_id for comment in comments]
    users = session.exec(select(User).where(User.id.in_(user_ids))).all() if user_ids else []
    user_map = {user.id: user.username for user in users}

    return [_comment_out(comment, user_map.get(comment.author_id, "Unknown")) for comment in comments]


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    payload: CommentCreate,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> CommentOut:
    post = session.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="write")

    comment = Comment(post_id=post_id, author_id=current_user.id, content=payload.content)
    session.add(comment)
    session.commit()
    session.refresh(comment)

    return _comment_out(comment, current_user.username)


def _can_edit(comment: Comment, current_user: CurrentUser) -> bool:
    return comment.author_id == current_user.id or has_admin_privilege(current_user)


@router.patch("/comments/{comment_id}", response_model=CommentOut)
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> CommentOut:
    comment = session.get(Comment, comment_id)
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    post = session.get(Post, comment.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="read")

    if not _can_edit(comment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit this comment")

    comment.content = payload.content
    comment.updated_at = datetime.now(timezone.utc)
    session.add(comment)
    session.commit()
    session.refresh(comment)

    author = session.get(User, comment.author_id)
    return _comment_out(comment, author.username if author else "Unknown")


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    comment = session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    post = session.get(Post, comment.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_board_permission(session, post.board_id, current_user, action="read")

    if not _can_edit(comment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this comment")

    comment.is_deleted = True
    comment.deleted_at = datetime.now(timezone.utc)
    comment.updated_at = datetime.now(timezone.utc)
    session.add(comment)
    session.commit()

    return {"message": "Comment deleted"}
