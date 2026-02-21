from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlmodel import Session, func, select

from app.core.deps import CurrentUser, ensure_board_permission, get_current_user, has_admin_privilege
from app.db.session import get_session
from app.models.attachment import Attachment
from app.models.comment import Comment
from app.models.enums import QnaStatus
from app.models.like import PostLike
from app.models.post import Post
from app.models.user import User
from app.schemas.post import AttachmentMeta, PostCreate, PostListItem, PostListResponse, PostOut, PostUpdate

router = APIRouter(prefix="/boards/{board_id}/posts", tags=["posts"])
VIEW_DEDUPE_SECONDS = 1.0
VIEW_GUARD_TTL_SECONDS = 300.0
VIEW_GUARD_MAX_SIZE = 20000
_view_guard_lock = Lock()
_view_guard: dict[tuple[int, int], float] = {}


def _validate_qna_status(qna_status: str | None) -> str | None:
    if qna_status is None:
        return None
    allowed = {status.value for status in QnaStatus}
    if qna_status not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid qna_status")
    return qna_status


def _author_names(session: Session, author_ids: list[int]) -> dict[int, str]:
    if not author_ids:
        return {}
    users = session.exec(select(User).where(User.id.in_(author_ids))).all()
    return {user.id: user.username for user in users}


def _post_metrics(
    session: Session, post_ids: list[int], current_user_id: int
) -> tuple[dict[int, int], dict[int, int], set[int]]:
    if not post_ids:
        return {}, {}, set()

    like_rows = session.exec(
        select(PostLike.post_id, func.count(PostLike.id))
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    ).all()
    like_count_map = {int(post_id): int(count) for post_id, count in like_rows}

    comment_rows = session.exec(
        select(Comment.post_id, func.count(Comment.id))
        .where(Comment.post_id.in_(post_ids))
        .where(Comment.is_deleted == False)
        .group_by(Comment.post_id)
    ).all()
    comment_count_map = {int(post_id): int(count) for post_id, count in comment_rows}

    liked_rows = session.exec(
        select(PostLike.post_id)
        .where(PostLike.post_id.in_(post_ids))
        .where(PostLike.user_id == current_user_id)
    ).all()
    liked_post_ids = {int(post_id) for post_id in liked_rows}

    return like_count_map, comment_count_map, liked_post_ids


def _post_to_out(session: Session, post: Post, current_user_id: int) -> PostOut:
    author = session.get(User, post.author_id)
    attachments = session.exec(select(Attachment).where(Attachment.post_id == post.id)).all()
    like_count_map, comment_count_map, liked_post_ids = _post_metrics(session, [post.id], current_user_id)

    return PostOut(
        id=post.id,
        board_id=post.board_id,
        title=post.title,
        content=post.content,
        author_id=post.author_id,
        author_name=author.username if author else "Unknown",
        is_pinned=post.is_pinned,
        is_deleted=post.is_deleted,
        view_count=post.view_count,
        like_count=like_count_map.get(post.id, 0),
        comment_count=comment_count_map.get(post.id, 0),
        liked_by_me=post.id in liked_post_ids,
        qna_status=post.qna_status,
        created_at=post.created_at,
        updated_at=post.updated_at,
        attachments=[
            AttachmentMeta(
                id=item.id,
                original_name=item.original_name,
                mime_type=item.mime_type,
                size_bytes=item.size_bytes,
                created_at=item.created_at,
            )
            for item in attachments
        ],
    )


def _ensure_pin_permission(current_user: CurrentUser) -> None:
    if not has_admin_privilege(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pin permission denied")


def _cleanup_view_guard(now_ts: float) -> None:
    if len(_view_guard) <= VIEW_GUARD_MAX_SIZE:
        return

    stale_before = now_ts - VIEW_GUARD_TTL_SECONDS
    stale_keys = [key for key, ts in _view_guard.items() if ts < stale_before]
    for key in stale_keys:
        _view_guard.pop(key, None)


def _should_increase_view(user_id: int, post_id: int) -> bool:
    now_ts = monotonic()
    key = (user_id, post_id)

    with _view_guard_lock:
        prev_ts = _view_guard.get(key)
        if prev_ts is not None and (now_ts - prev_ts) < VIEW_DEDUPE_SECONDS:
            return False

        _view_guard[key] = now_ts
        _cleanup_view_guard(now_ts)
        return True


@router.get("", response_model=PostListResponse)
def list_posts(
    board_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = None,
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    qna_status: str | None = None,
    is_pinned: bool | None = None,
    include_deleted: bool = False,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> PostListResponse:
    board = ensure_board_permission(session, board_id, current_user, action="read")

    conditions = [Post.board_id == board.id]
    if search:
        conditions.append(or_(Post.title.contains(search), Post.content.contains(search)))
    if qna_status:
        conditions.append(Post.qna_status == qna_status)
    if is_pinned is not None:
        conditions.append(Post.is_pinned == is_pinned)

    can_view_deleted = current_user.role_code == "ADMIN"
    if not include_deleted or not can_view_deleted:
        conditions.append(Post.is_deleted == False)

    sort_map = {
        "created_at": Post.created_at,
        "updated_at": Post.updated_at,
        "title": Post.title,
        "view_count": Post.view_count,
    }
    sort_column = sort_map.get(sort_by, Post.created_at)
    ordered = sort_column.asc() if sort_order.lower() == "asc" else sort_column.desc()

    statement = (
        select(Post)
        .where(*conditions)
        .order_by(Post.is_pinned.desc(), ordered, Post.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = session.exec(statement).all()

    total = session.exec(select(func.count()).select_from(Post).where(*conditions)).one()
    author_map = _author_names(session, [item.author_id for item in items])
    post_ids = [item.id for item in items]
    like_count_map, comment_count_map, liked_post_ids = _post_metrics(session, post_ids, current_user.id)

    return PostListResponse(
        items=[
            PostListItem(
                id=item.id,
                board_id=item.board_id,
                title=item.title,
                author_id=item.author_id,
                author_name=author_map.get(item.author_id, "Unknown"),
                is_pinned=item.is_pinned,
                is_deleted=item.is_deleted,
                view_count=item.view_count,
                like_count=like_count_map.get(item.id, 0),
                comment_count=comment_count_map.get(item.id, 0),
                liked_by_me=item.id in liked_post_ids,
                qna_status=item.qna_status,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    board_id: int,
    payload: PostCreate,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> PostOut:
    board = ensure_board_permission(session, board_id, current_user, action="write")
    if payload.is_pinned:
        _ensure_pin_permission(current_user)

    qna_status = _validate_qna_status(payload.qna_status)
    if board.key != "qna":
        qna_status = None
    elif qna_status is None:
        qna_status = QnaStatus.OPEN.value

    post = Post(
        board_id=board.id,
        title=payload.title,
        content=payload.content,
        author_id=current_user.id,
        is_pinned=payload.is_pinned,
        qna_status=qna_status,
    )
    session.add(post)
    session.commit()
    session.refresh(post)

    return _post_to_out(session, post, current_user.id)


@router.get("/{post_id}", response_model=PostOut)
def get_post(
    board_id: int,
    post_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> PostOut:
    ensure_board_permission(session, board_id, current_user, action="read")
    post = session.get(Post, post_id)
    if not post or post.board_id != board_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if post.is_deleted and current_user.role_code != "ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if _should_increase_view(current_user.id, post.id):
        post.view_count += 1
        session.add(post)
        session.commit()
        session.refresh(post)

    return _post_to_out(session, post, current_user.id)


def _can_edit_post(post: Post, current_user: CurrentUser) -> bool:
    return post.author_id == current_user.id or has_admin_privilege(current_user)


@router.patch("/{post_id}", response_model=PostOut)
def update_post(
    board_id: int,
    post_id: int,
    payload: PostUpdate,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> PostOut:
    board = ensure_board_permission(session, board_id, current_user, action="write")

    post = session.get(Post, post_id)
    if not post or post.board_id != board.id or post.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if not _can_edit_post(post, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit this post")

    updates = payload.model_dump(exclude_unset=True)
    if "is_pinned" in updates:
        _ensure_pin_permission(current_user)

    if "qna_status" in updates:
        updates["qna_status"] = _validate_qna_status(updates["qna_status"])
        if board.key != "qna":
            updates["qna_status"] = None

    for key, value in updates.items():
        setattr(post, key, value)

    post.updated_at = datetime.now(timezone.utc)
    session.add(post)
    session.commit()
    session.refresh(post)

    return _post_to_out(session, post, current_user.id)


@router.delete("/{post_id}")
def delete_post(
    board_id: int,
    post_id: int,
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    ensure_board_permission(session, board_id, current_user, action="write")

    post = session.get(Post, post_id)
    if not post or post.board_id != board_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    if not _can_edit_post(post, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this post")

    post.is_deleted = True
    post.deleted_at = datetime.now(timezone.utc)
    post.updated_at = datetime.now(timezone.utc)
    session.add(post)
    session.commit()

    return {"message": "Post deleted"}
