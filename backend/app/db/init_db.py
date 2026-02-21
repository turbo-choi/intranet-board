from __future__ import annotations

from sqlmodel import SQLModel

from app.db.session import engine
from app.models import Attachment, Board, Comment, Menu, MenuPermission, Post, PostLike, RefreshToken, Role, User  # noqa: F401


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
