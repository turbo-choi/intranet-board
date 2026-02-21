# Backend AI Context & Governance

## Module Context

- Role: Provides REST APIs for auth, RBAC, boards/posts/comments/likes/attachments, and admin console management.
- Dependency boundary: `backend/requirements.txt`.

## Runtime & Commands

- Run API:
  - `cd backend`
  - `source .venv/bin/activate`
  - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Init/seed DB:
  - `cd backend`
  - `source .venv/bin/activate`
  - `PYTHONPATH=. python scripts/init_seed.py`
- Sanity compile:
  - `python3 -m compileall backend/app`

## Architecture Map

- `app/main.py`: FastAPI app bootstrap, CORS, router registration.
- `app/api/routes/`: HTTP endpoints grouped by domain.
  - `auth.py`: login/register/me/refresh/logout.
  - `boards.py`, `posts.py`, `comments.py`, `likes.py`, `attachments.py`, `menus.py`, `dashboard.py`.
  - `admin_boards.py`, `admin_menus.py`, `admin_users.py`, `admin_roles.py`.
- `app/core/`: settings, JWT/password security, dependency helpers.
- `app/models/`: SQLModel entities.
- `app/schemas/`: request/response Pydantic schemas.
- `app/db/`: engine/session/init/seed.

## Behavior Contracts (Must Keep)

- Auth:
  - JWT access/refresh token flow.
  - Endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`.
- RBAC:
  - Roles: `ADMIN`, `MANAGER`, `USER`.
  - Board-level `read_roles`/`write_roles` enforced in route dependencies.
- Post pin policy:
  - `is_pinned` write is allowed only for `ADMIN` or `MANAGER` (server-enforced in `posts.py`).
- View count policy:
  - Post detail view increment is deduplicated for same `(user_id, post_id)` in a short interval to avoid multi-increment bursts.
- Delete policies:
  - Post delete is soft delete (`is_deleted=true`).
  - Menu delete is soft delete (`is_active=false`).
  - Category delete (`path="__category__"`) is hard delete only if no children; otherwise `409` with `"사용중이라 삭제할 수 없습니다."`.
- Q&A:
  - `qna_status` allowed values: `OPEN`, `IN_PROGRESS`, `ANSWERED`.
  - Non-Q&A boards must not persist `qna_status`.

## Seed Defaults (Source: `app/db/seed.py`)

- Roles: `ADMIN`, `MANAGER`, `USER`.
- Admin account: `admin / admin1234`.
- Base boards: Notice, Free Board, Library, Q&A.
- Base categories/menus:
  - Categories: `Menu`, `Management`.
  - Management children: Board/Menu/Member/Role management pages.
- Test users/posts:
  - `testuser1..5` (`test1234`), each has 10 seed posts (missing items only on rerun).

## Change Rules

- When changing model fields, update both SQLModel entity and Pydantic schemas together.
- Keep API response contracts aligned with frontend `frontend/src/lib/types.ts`.
- Do not bypass dependency-based auth checks (`Depends(get_current_user)`, `require_roles`, board permission guards).
- Update root docs together when behavior changes:
  - `README.md`
  - `AGENTS.md`
