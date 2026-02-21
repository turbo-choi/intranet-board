from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.deps import CurrentUser, can_access_menu, get_current_user
from app.db.session import get_session
from app.models.menu import Menu
from app.schemas.menu import MenuOut

router = APIRouter(prefix="/menus", tags=["menus"])
CATEGORY_PATH = "__category__"


@router.get("", response_model=list[MenuOut])
def list_menus(
    session: Session = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[MenuOut]:
    statement = select(Menu).where(Menu.is_active == True).order_by(Menu.sort_order.asc(), Menu.id.asc())
    menus = session.exec(statement).all()

    if current_user.role_code == "ADMIN":
        return [MenuOut(**menu.model_dump()) for menu in menus]

    visible_items = [menu for menu in menus if menu.path != CATEGORY_PATH and can_access_menu(session, menu, current_user.role_code, "read")]
    visible_item_ids = {menu.id for menu in visible_items}
    visible_category_ids = {menu.parent_id for menu in visible_items if menu.parent_id}

    visible_menus: list[Menu] = []
    for menu in menus:
        if menu.path == CATEGORY_PATH:
            if menu.id in visible_category_ids:
                visible_menus.append(menu)
            continue
        if menu.id in visible_item_ids:
            visible_menus.append(menu)

    return [MenuOut(**menu.model_dump()) for menu in visible_menus]
