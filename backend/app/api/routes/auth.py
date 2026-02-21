from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.deps import CurrentUser, get_current_user
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.session import get_session
from app.models.enums import RoleCode
from app.models.auth import RefreshToken
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, TokenPair, UserMe

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_pair(session: Session, user: User, role: Role) -> TokenPair:
    access_token = create_access_token(user.id, role.code)
    refresh_token = create_refresh_token(user.id, role.code)
    payload = decode_token(refresh_token, expected_type="refresh")
    expires_at = datetime.utcfromtimestamp(payload["exp"])

    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    session.commit()

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> TokenPair:
    statement = select(User).where(User.username == payload.username)
    user = session.exec(statement).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.is_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is locked")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    role = session.get(Role, user.role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Role missing")

    return _build_token_pair(session, user, role)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_session)) -> TokenPair:
    duplicate_username = session.exec(select(User).where(User.username == payload.username)).first()
    if duplicate_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    duplicate_email = session.exec(select(User).where(User.email == payload.email)).first()
    if duplicate_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    user_role = session.exec(select(Role).where(Role.code == RoleCode.USER.value)).first()
    if not user_role:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Default USER role missing")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role_id=user_role.id,
        is_locked=False,
        is_active=True,
    )
    session.add(user)
    session.flush()

    return _build_token_pair(session, user, user_role)


@router.get("/me", response_model=UserMe)
def me(current_user: CurrentUser = Depends(get_current_user), session: Session = Depends(get_session)) -> UserMe:
    db_user = session.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserMe(
        id=db_user.id,
        username=db_user.username,
        email=db_user.email,
        role=current_user.role_code,
        is_locked=db_user.is_locked,
        created_at=db_user.created_at,
    )


@router.post("/refresh", response_model=TokenPair)
def refresh_tokens(payload: RefreshRequest, session: Session = Depends(get_session)) -> TokenPair:
    try:
        token_payload = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    token_hash = hash_token(payload.refresh_token)
    stored = session.exec(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).first()

    if not stored or stored.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid")

    if stored.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_id = int(token_payload.get("sub", 0))
    user = session.get(User, user_id)
    if not user or user.is_locked or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    role = session.get(Role, user.role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Role unavailable")

    stored.revoked_at = datetime.utcnow()
    session.add(stored)
    session.commit()

    return _build_token_pair(session, user, role)


@router.post("/logout")
def logout(payload: LogoutRequest, session: Session = Depends(get_session)) -> dict[str, str]:
    try:
        decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    token_hash = hash_token(payload.refresh_token)
    stored = session.exec(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).first()
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.utcnow()
        session.add(stored)
        session.commit()

    return {"message": "Logged out"}
