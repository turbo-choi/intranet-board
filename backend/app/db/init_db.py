from __future__ import annotations

from sqlalchemy import text
from sqlmodel import SQLModel

from app.db.session import engine
from app.models import Attachment, Board, Comment, Menu, MenuPermission, Post, PostLike, RefreshToken, Role, User  # noqa: F401


def _ensure_board_type_column() -> None:
    with engine.begin() as conn:
        columns = [str(row[1]) for row in conn.execute(text("PRAGMA table_info(boards)")).fetchall()]
        if "board_type" not in columns:
            conn.execute(text("ALTER TABLE boards ADD COLUMN board_type VARCHAR(20) NOT NULL DEFAULT 'GENERAL'"))
        conn.execute(text("UPDATE boards SET board_type='QNA' WHERE lower(key)='qna'"))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_board_type_column()
