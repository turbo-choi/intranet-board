from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.deps import CurrentUser, require_roles
from app.db.session import get_session
from app.models.menu import Menu
from app.schemas.menu import MenuCreate, MenuOut, MenuReorderItem, MenuUpdate

router = APIRouter(prefix="/admin/menus", tags=["admin-menus"])
CATEGORY_PATH = "__category__"


@router.get("", response_model=list[MenuOut])
def list_admin_menus(
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> list[MenuOut]:
    menus = session.exec(select(Menu).order_by(Menu.sort_order.asc(), Menu.id.asc())).all()
    return [MenuOut(**menu.model_dump()) for menu in menus]


@router.post("", response_model=MenuOut, status_code=status.HTTP_201_CREATED)
def create_menu(
    payload: MenuCreate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> MenuOut:
    data = payload.model_dump()
    path = data["path"].strip()
    if not path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is required")
    if path != CATEGORY_PATH and not path.startswith("/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path must start with '/'")

    data["path"] = path

    if path == CATEGORY_PATH:
        data["parent_id"] = None
        data["board_id"] = None

    menu = Menu(**data)
    session.add(menu)
    session.commit()
    session.refresh(menu)
    return MenuOut(**menu.model_dump())


@router.patch("/{menu_id}", response_model=MenuOut)
def update_menu(
    menu_id: int,
    payload: MenuUpdate,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> MenuOut:
    menu = session.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found")

    updates = payload.model_dump(exclude_unset=True)
    if "path" in updates:
        updates["path"] = updates["path"].strip()
        if not updates["path"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path is required")
        if updates["path"] != CATEGORY_PATH and not updates["path"].startswith("/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path must start with '/'")

    next_path = updates.get("path", menu.path)
    if next_path == CATEGORY_PATH:
        updates["parent_id"] = None
        updates["board_id"] = None

    for key, value in updates.items():
        setattr(menu, key, value)
    menu.updated_at = datetime.now(timezone.utc)

    session.add(menu)
    session.commit()
    session.refresh(menu)
    return MenuOut(**menu.model_dump())


@router.put("/reorder")
def reorder_menus(
    payload: list[MenuReorderItem],
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> dict[str, str]:
    for item in payload:
        menu = session.get(Menu, item.id)
        if not menu:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Menu {item.id} not found")
        menu.sort_order = item.sort_order
        menu.updated_at = datetime.now(timezone.utc)
        session.add(menu)

    session.commit()
    return {"message": "Menu order updated"}


@router.delete("/{menu_id}")
def deactivate_menu(
    menu_id: int,
    session: Session = Depends(get_session),
    _: CurrentUser = Depends(require_roles("ADMIN")),
) -> dict[str, str]:
    menu = session.get(Menu, menu_id)
    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu not found")

    if menu.path == CATEGORY_PATH:
        has_children = session.exec(select(Menu.id).where(Menu.parent_id == menu.id).limit(1)).first()
        if has_children:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="사용중이라 삭제할 수 없습니다.")

        session.delete(menu)
        session.commit()
        return {"message": "Category deleted"}

    menu.is_active = False
    menu.updated_at = datetime.now(timezone.utc)
    session.add(menu)
    session.commit()
    return {"message": "Menu deactivated"}
