from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlmodel import Session, func, select

from app.core.deps import CurrentUser, require_roles
from app.db.session import get_session
from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserListResponse, UserLockUpdate, UserOut, UserRoleUpdate

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("", response_model=UserListResponse)
def list_users(
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> UserListResponse:
    conditions = []
    if search:
        conditions.append(
            or_(
                User.username.contains(search),
                User.email.contains(search),
            )
        )

    statement = (
        select(User)
        .where(*conditions)
        .order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    users = session.exec(statement).all()
    total = session.exec(select(func.count()).select_from(User).where(*conditions)).one()

    role_ids = list({user.role_id for user in users})
    roles = session.exec(select(Role).where(Role.id.in_(role_ids))).all() if role_ids else []
    role_map = {role.id: role.code for role in roles}

    return UserListResponse(
        items=[
            UserOut(
                id=user.id,
                username=user.username,
                email=user.email,
                role=role_map.get(user.role_id, "UNKNOWN"),
                is_locked=user.is_locked,
                is_active=user.is_active,
                created_at=user.created_at,
            )
            for user in users
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> UserOut:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    role = session.exec(select(Role).where(Role.code == payload.role_code)).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    user.role_id = role.id
    session.add(user)
    session.commit()
    session.refresh(user)

    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=role.code,
        is_locked=user.is_locked,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.patch("/{user_id}/lock", response_model=UserOut)
def update_user_lock(
    user_id: int,
    payload: UserLockUpdate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> UserOut:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_locked = payload.is_locked
    session.add(user)
    session.commit()
    session.refresh(user)

    role = session.get(Role, user.role_id)
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=role.code if role else "UNKNOWN",
        is_locked=user.is_locked,
        is_active=user.is_active,
        created_at=user.created_at,
    )
