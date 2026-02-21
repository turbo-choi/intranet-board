from __future__ import annotations

from sqlmodel import Session, create_engine

from app.core.config import settings


engine = create_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})


def get_session():
    with Session(engine) as session:
        yield session
