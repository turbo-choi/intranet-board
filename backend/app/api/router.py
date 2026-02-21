from fastapi import APIRouter

from app.api.routes import (
    admin_boards,
    admin_menus,
    admin_roles,
    admin_users,
    attachments,
    auth,
    boards,
    comments,
    dashboard,
    likes,
    menus,
    posts,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(boards.router)
api_router.include_router(menus.router)
api_router.include_router(posts.router)
api_router.include_router(comments.router)
api_router.include_router(likes.router)
api_router.include_router(attachments.router)
api_router.include_router(dashboard.router)
api_router.include_router(admin_boards.router)
api_router.include_router(admin_menus.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_roles.router)
