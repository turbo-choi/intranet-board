from __future__ import annotations

from sqlmodel import Session, select

from app.core.security import hash_password
from app.db.init_db import create_db_and_tables
from app.db.session import engine
from app.models.board import Board
from app.models.enums import BoardType, QnaStatus, RoleCode, SystemPermission
from app.models.menu import Menu
from app.models.menu_permission import MenuPermission
from app.models.post import Post
from app.models.role import Role
from app.models.user import User


def seed_roles(session: Session) -> dict[str, Role]:
    defaults = [
        {
            "code": RoleCode.ADMIN.value,
            "name": "Administrator",
            "description": "Full system access",
            "system_permissions": [
                SystemPermission.MANAGE_BOARDS.value,
                SystemPermission.MANAGE_MENUS.value,
                SystemPermission.MANAGE_USERS.value,
                SystemPermission.MANAGE_ROLES.value,
                SystemPermission.MODERATE_CONTENT.value,
            ],
        },
        {
            "code": RoleCode.MANAGER.value,
            "name": "Manager",
            "description": "Content operation and moderation",
            "system_permissions": [
                SystemPermission.MODERATE_CONTENT.value,
                SystemPermission.MANAGE_BOARDS.value,
            ],
        },
        {
            "code": RoleCode.USER.value,
            "name": "User",
            "description": "General employee",
            "system_permissions": [],
        },
    ]

    result: dict[str, Role] = {}
    for item in defaults:
        role = session.exec(select(Role).where(Role.code == item["code"])).first()
        if not role:
            role = Role(**item)
            session.add(role)
            session.flush()
        else:
            role.name = item["name"]
            role.description = item["description"]
            role.system_permissions = item["system_permissions"]
        result[role.code] = role

    return result


def seed_admin_user(session: Session, roles: dict[str, Role]) -> None:
    admin = session.exec(select(User).where(User.username == "admin")).first()
    if admin:
        admin.email = "admin@corpboard.com"
        admin.role_id = roles[RoleCode.ADMIN.value].id
        admin.is_active = True
        session.add(admin)
        return

    session.add(
        User(
            username="admin",
            email="admin@corpboard.com",
            password_hash=hash_password("admin1234"),
            role_id=roles[RoleCode.ADMIN.value].id,
            is_active=True,
            is_locked=False,
        )
    )


def seed_test_users(session: Session, roles: dict[str, Role]) -> list[User]:
    user_role_id = roles[RoleCode.USER.value].id
    users: list[User] = []
    for index in range(1, 6):
        username = f"testuser{index}"
        email = f"testuser{index}@corpboard.com"
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            user = User(
                username=username,
                email=email,
                password_hash=hash_password("test1234"),
                role_id=user_role_id,
                is_active=True,
                is_locked=False,
            )
            session.add(user)
            session.flush()
        else:
            user.email = email
            user.role_id = user_role_id
            user.is_active = True
            user.is_locked = False
            session.add(user)
        users.append(user)
    return users


def seed_test_posts(session: Session, boards: dict[str, Board], users: list[User]) -> None:
    cycle = [boards["free"], boards["qna"], boards["free"], boards["free"], boards["qna"]]

    for user in users:
        existing = session.exec(
            select(Post).where(Post.author_id == user.id).where(Post.title.contains("[SEED TEST]"))
        ).all()
        existing_numbers: set[int] = set()
        for post in existing:
            try:
                existing_numbers.add(int(post.title.rsplit(" ", 1)[-1]))
            except ValueError:
                continue

        for number in range(1, 11):
            if number in existing_numbers:
                continue
            board = cycle[(number - 1) % len(cycle)]
            qna_status = None
            if board.board_type == BoardType.QNA.value:
                qna_status = QnaStatus.ANSWERED.value if number % 2 == 0 else QnaStatus.OPEN.value

            post = Post(
                board_id=board.id,
                title=f"[SEED TEST] {user.username} sample post {number}",
                content=f"Auto-generated test content #{number} by {user.username} on {board.name}.",
                author_id=user.id,
                is_pinned=False,
                qna_status=qna_status,
            )
            session.add(post)


def seed_boards(session: Session) -> dict[str, Board]:
    defaults = [
        {
            "key": "notice",
            "name": "Notice",
            "description": "Company-wide announcements",
            "board_type": BoardType.GENERAL.value,
            "sort_order": 1,
            "read_roles": [RoleCode.USER.value, RoleCode.MANAGER.value, RoleCode.ADMIN.value],
            "write_roles": [RoleCode.MANAGER.value, RoleCode.ADMIN.value],
        },
        {
            "key": "free",
            "name": "Free Board",
            "description": "Open discussion board",
            "board_type": BoardType.GENERAL.value,
            "sort_order": 2,
            "read_roles": [RoleCode.USER.value, RoleCode.MANAGER.value, RoleCode.ADMIN.value],
            "write_roles": [RoleCode.USER.value, RoleCode.MANAGER.value, RoleCode.ADMIN.value],
        },
        {
            "key": "library",
            "name": "Library",
            "description": "Shared resources and templates",
            "board_type": BoardType.GENERAL.value,
            "sort_order": 3,
            "read_roles": [RoleCode.USER.value, RoleCode.MANAGER.value, RoleCode.ADMIN.value],
            "write_roles": [RoleCode.MANAGER.value, RoleCode.ADMIN.value],
        },
        {
            "key": "qna",
            "name": "Q&A",
            "description": "Questions and answers",
            "board_type": BoardType.QNA.value,
            "sort_order": 4,
            "read_roles": [RoleCode.USER.value, RoleCode.MANAGER.value, RoleCode.ADMIN.value],
            "write_roles": [RoleCode.USER.value, RoleCode.MANAGER.value, RoleCode.ADMIN.value],
        },
    ]

    result: dict[str, Board] = {}
    for item in defaults:
        board = session.exec(select(Board).where(Board.key == item["key"])).first()
        if not board:
            board = Board(**item)
            session.add(board)
            session.flush()
        else:
            board.name = item["name"]
            board.description = item["description"]
            board.board_type = item["board_type"]
            board.sort_order = item["sort_order"]
            board.is_active = True
            board.read_roles = item["read_roles"]
            board.write_roles = item["write_roles"]
        result[board.key] = board

    return result


def seed_menus(session: Session, boards: dict[str, Board]) -> None:
    category_path = "__category__"

    main_category = session.exec(select(Menu).where(Menu.path == category_path).where(Menu.name == "Menu")).first()
    if not main_category:
        main_category = Menu(name="Menu", path=category_path, icon="LayoutDashboard", sort_order=1, board_id=None, parent_id=None, is_active=True)
        session.add(main_category)
        session.flush()
    else:
        main_category.icon = "LayoutDashboard"
        main_category.sort_order = 1
        main_category.parent_id = None
        main_category.board_id = None
        main_category.is_active = True
        session.add(main_category)

    management_category = session.exec(select(Menu).where(Menu.path == category_path).where(Menu.name == "Management")).first()
    if not management_category:
        management_category = Menu(name="Management", path=category_path, icon="Shield", sort_order=100, board_id=None, parent_id=None, is_active=True)
        session.add(management_category)
        session.flush()
    else:
        management_category.icon = "Shield"
        management_category.sort_order = 100
        management_category.parent_id = None
        management_category.board_id = None
        management_category.is_active = True
        session.add(management_category)

    defaults = [
        {
            "name": "Notice",
            "path": f"/boards/{boards['notice'].id}",
            "icon": "Bell",
            "sort_order": 1,
            "board_id": boards["notice"].id,
            "parent_id": main_category.id,
        },
        {
            "name": "Free Board",
            "path": f"/boards/{boards['free'].id}",
            "icon": "MessageCircle",
            "sort_order": 2,
            "board_id": boards["free"].id,
            "parent_id": main_category.id,
        },
        {
            "name": "Library",
            "path": f"/boards/{boards['library'].id}",
            "icon": "Library",
            "sort_order": 3,
            "board_id": boards["library"].id,
            "parent_id": main_category.id,
        },
        {
            "name": "Q&A",
            "path": f"/boards/{boards['qna'].id}",
            "icon": "CircleHelp",
            "sort_order": 4,
            "board_id": boards["qna"].id,
            "parent_id": main_category.id,
        },
        {
            "name": "Board Management",
            "path": "/admin/boards",
            "icon": "Shield",
            "sort_order": 101,
            "board_id": None,
            "parent_id": management_category.id,
        },
        {
            "name": "Menu Management",
            "path": "/admin/menus",
            "icon": "Settings",
            "sort_order": 102,
            "board_id": None,
            "parent_id": management_category.id,
        },
        {
            "name": "Member Management",
            "path": "/admin/users",
            "icon": "LayoutDashboard",
            "sort_order": 103,
            "board_id": None,
            "parent_id": management_category.id,
        },
        {
            "name": "Role Management",
            "path": "/admin/roles",
            "icon": "Shield",
            "sort_order": 104,
            "board_id": None,
            "parent_id": management_category.id,
        },
    ]

    for item in defaults:
        menu = session.exec(select(Menu).where(Menu.path == item["path"])).first()
        if not menu:
            session.add(Menu(**item, is_active=True))
        else:
            menu.name = item["name"]
            menu.icon = item["icon"]
            menu.sort_order = item["sort_order"]
            menu.board_id = item["board_id"]
            menu.parent_id = item["parent_id"]
            menu.is_active = True
            session.add(menu)


def seed_menu_permissions(session: Session, roles: dict[str, Role], boards: dict[str, Board]) -> None:
    board_by_id = {board.id: board for board in boards.values()}
    role_codes = set(roles.keys())
    menus = session.exec(
        select(Menu)
        .where(Menu.is_active == True)
        .where(Menu.path != "__category__")
        .order_by(Menu.sort_order.asc(), Menu.id.asc())
    ).all()

    for menu in menus:
        default_read_roles: set[str] = set()
        default_write_roles: set[str] = set()

        if menu.path.startswith("/admin"):
            default_read_roles = {RoleCode.ADMIN.value}
            default_write_roles = {RoleCode.ADMIN.value}
        elif menu.board_id and menu.board_id in board_by_id:
            board = board_by_id[menu.board_id]
            default_read_roles = set(board.read_roles or [])
            default_write_roles = set(board.write_roles or [])
        else:
            # For non-board, non-admin routes, default to admin-only until explicitly granted.
            default_read_roles = {RoleCode.ADMIN.value}
            default_write_roles = {RoleCode.ADMIN.value}

        target_roles = (default_read_roles | default_write_roles) & role_codes
        for role_code in target_roles:
            existing = session.exec(
                select(MenuPermission)
                .where(MenuPermission.menu_id == menu.id)
                .where(MenuPermission.role_code == role_code)
            ).first()
            if existing:
                continue

            session.add(
                MenuPermission(
                    menu_id=menu.id,
                    role_code=role_code,
                    can_read=role_code in default_read_roles,
                    can_write=role_code in default_write_roles,
                )
            )


def seed_all() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        roles = seed_roles(session)
        seed_admin_user(session, roles)
        boards = seed_boards(session)
        seed_menus(session, boards)
        seed_menu_permissions(session, roles, boards)
        test_users = seed_test_users(session, roles)
        seed_test_posts(session, boards, test_users)
        session.commit()


if __name__ == "__main__":
    seed_all()
    print("Database initialized and seeded.")
