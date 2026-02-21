# Frontend AI Context & Governance

## Module Context

- Role: Renders user/admin UI for the integrated board system and coordinates authenticated API calls.
- Dependency boundary: `frontend/package.json`.

## Runtime & Commands

- Run dev server:
  - `cd frontend`
  - `npm run dev`
- Production build check:
  - `cd frontend`
  - `npm run build`

## Architecture Map

- `src/app/`: App Router pages and layouts.
  - Auth: `/login`, `/signup`.
  - User: `/dashboard`, `/boards/[boardId]`, post detail/write pages.
  - Admin: `/admin/boards`, `/admin/menus`, `/admin/users`, `/admin/roles`.
- `src/components/`: App shell, shared UI controls, toast, theme toggle.
- `src/hooks/`: auth/session-related client hooks.
- `src/lib/`: API client, type definitions, theme/menu caches, icon registry.

## UI Behavior Contracts (Must Keep)

- Layout shell (`src/components/app-shell.tsx`):
  - Left navigation + top header heights aligned with `h-16`.
  - Mobile: drawer menu (`md:hidden`) with overlay and close handling.
  - Desktop: collapsible sidebar (icon-only compact mode).
  - Categories are collapsible and persisted to localStorage.
  - Category children are indented one level under category header.
- Navigation transition:
  - Sidebar menu click triggers content fade-out then route push.
  - Main content fade-in/out should remain smooth and deterministic.
- Theme:
  - Dark/light mode via `ThemeToggle` and `corp_theme` localStorage key.
  - Root layout boot script applies initial theme before hydration to avoid flash/mismatch.
- Feedback:
  - Save/delete flows should show toast messages through `ToastProvider` and `useToast`.

## Data/Contract Notes

- Use `apiRequest` (`src/lib/api-client.ts`) for authenticated requests and unified error handling.
- Menu data is server-driven:
  - Do not hardcode admin menu entries in UI.
  - Render from `/api/menus` response and icon mapping in `src/lib/menu-icons.ts`.
- Menu icon extension point:
  - Add icon imports + mappings in `menuIconMap`.
  - Add selectable key in `MENU_ICON_OPTIONS`.

## Change Rules

- If API contract changes, update together:
  - `src/lib/types.ts`
  - consumer pages/components
  - `README.md` and root `AGENTS.md`
- Avoid introducing client-only nondeterminism in SSR trees:
  - No `Date.now()`/`Math.random()` in initial render output.
  - Keep `window/localStorage` reads inside effects or guarded init paths.
