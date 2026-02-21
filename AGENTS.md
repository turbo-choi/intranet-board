# AI Context & Governance: Corporate Integrated Board System

## Project Context & Operations

- Business Goal: Corporate Integrated Board System (Notice, Free Board, Library, Q&A + Admin Console).
- Tech Stack:
  - Frontend: Next.js (App Router), TypeScript, Tailwind, lucide-react
  - Backend: FastAPI, Pydantic, SQLModel, SQLite
- Operational Commands:
  - Backend run: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
  - Frontend run: `cd frontend && npm run dev`
  - DB init/seed: `cd backend && source .venv/bin/activate && PYTHONPATH=. python scripts/init_seed.py`
  - Backend compile check: `python3 -m compileall backend/app`
  - Frontend production check: `cd frontend && npm run build`

## Current Behavior Contracts (Must Keep)

- Auth/RBAC:
  - JWT login/register/me/refresh/logout
  - Roles: `ADMIN`, `MANAGER`, `USER`
- Post pin policy:
  - `is_pinned` write is allowed only for `ADMIN`/`MANAGER` (backend-enforced)
- View count policy:
  - Deduplicated for the same `(user, post)` in short interval to prevent multi-increment from duplicate fetches
- Menu/category policy:
  - Category is represented as `path="__category__"`
  - Category delete: hard delete only if unused
  - If category has child menus, delete is blocked with: `"사용중이라 삭제할 수 없습니다."`
  - Normal menu delete stays soft delete (`is_active=false`)
  - Admin section menus are DB-driven menu records (not hardcoded UI entries)
- UI behavior:
  - Sidebar supports desktop icon-only collapse and mobile drawer navigation
  - Sidebar categories are collapsible (state in localStorage)
  - Category children are rendered with one-level indentation
  - Menu navigation/content transitions include fade animation
  - Global save/delete toast is enabled via `ToastProvider`
  - Theme toggle supports dark/light mode

## Key Source of Truth Files

- Menu icon registry and selectable options: `frontend/src/lib/menu-icons.ts`
- Sidebar/menu rendering & transitions: `frontend/src/components/app-shell.tsx`
- Menu admin page (category/menu CRUD): `frontend/src/app/admin/menus/page.tsx`
- Menu backend API: `backend/app/api/routes/admin_menus.py`
- Post permissions/views logic: `backend/app/api/routes/posts.py`
- DB seed defaults: `backend/app/db/seed.py`
- API client error behavior: `frontend/src/lib/api-client.ts`

## Golden Rules

- Never commit `.env` or any secret.
- Keep FE/BE contract changes synchronized (schema + type + UI behavior).
- Do not bypass JWT or RBAC checks in protected endpoints.
- When behavior contracts above change, update `README.md` and this `AGENTS.md` together.

## Context Map

- **[Frontend Architecture (Next.js)](./frontend/AGENTS.md)** — page routing, UI components, client hooks, transitions/theme/toast.
- **[Backend Architecture (FastAPI)](./backend/AGENTS.md)** — API routes, SQLModel entities, auth, permission rules, seed/init.
