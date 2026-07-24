# HealthApp — Implementation Plan

**Spec:** [../specs/2026-07-23-healthapp-design.md](../specs/2026-07-23-healthapp-design.md)
**Date:** 2026-07-23

Each phase ends in a working, verifiable state. Verification is run before a phase is called done.

## Phase 1 — Skeleton & infrastructure

**Goal:** monorepo scaffold, DB layer, Docker image that boots and serves a page.

- Scaffold `/client` (Vite + React 18 + TS + Tailwind + React Router + TanStack Query) and `/server` (Express + TS, tsx for dev, esbuild for prod build).
- Drizzle ORM + better-sqlite3; migration runner executes versioned migrations on startup; DB path from `DATA_DIR` env (default `/data`), WAL mode.
- Express serves `/api/*`, static client build, SPA history fallback; `GET /healthz`.
- Root `package.json` workspaces + dev script (concurrent client dev server proxying `/api`).
- Multi-stage Dockerfile + docker-compose.yml (port 3420, `./data:/data`).
- Vitest wired up on server with a temp-DB test helper.

**Verify:** `npm run dev` shows placeholder app; `docker compose up` boots, `/healthz` returns ok; a trivial migration test passes.

## Phase 2 — Auth, setup wizard, user admin

**Goal:** multi-user foundation everything else hangs on.

- `users` table + migrations; bcrypt; express-session with SQLite store; httpOnly SameSite=Lax cookie.
- `/api/auth/setup` (only when no users exist), `/api/auth/login|logout|me`.
- First-run wizard UI (create admin, pick units/timezone) → login page → authed app shell with top navbar (hamburger on mobile), dark slate/neon theme tokens defined in Tailwind config.
- Admin panel: create user, reset password, deactivate. `requireAuth` / `requireAdmin` middleware.
- Per-user settings storage (units, week start; targets come in Phase 6).

**Verify:** integration tests — setup only works once; login/logout; non-admin blocked from admin routes; user A cannot read user B's data (test harness with two users, reused in later phases).

## Phase 3 — Exercise library

**Goal:** browsable seeded library + custom exercises.

- Vendor free-exercise-db JSON + images into the repo (license file included); seed script runs on first startup (idempotent).
- `exercises` table with category, muscles, equipment, instructions, images, `owner_id` (null = bundled), soft delete.
- API: list with search/filter/pagination; CRUD for user-owned custom exercises.
- UI: library page (search box, muscle/equipment/category filters, card grid), exercise detail page (instructions, images; history/PR sections stubbed until Phase 5), custom-exercise form.

**Verify:** seed test (count > 800, idempotent re-run); filter/search API tests; custom exercise CRUD + ownership tests; library usable on mobile viewport.

## Phase 4 — Routines & calendar

- `routines`, `routine_exercises`, `schedule` tables; CRUD APIs; duplicate-routine endpoint.
- Routine builder UI: pick exercises from library, order them (up/down controls), per-exercise targets by category, notes.
- Calendar page: month/week views; assign routine to weekday (recurring) or date (one-off); shows scheduled + completed (once Phase 5 lands).

**Verify:** API tests for routine CRUD/ordering/duplication and schedule resolution ("what's planned for date X"); builder flow works on phone.

## Phase 5 — Workout sessions (the core loop)

- `workout_sessions`, `session_exercises`, `sets` tables; session lifecycle API (start from routine/freeform, add/edit/complete sets, add/remove exercises, finish, edit past).
- Live session UI: per-category set inputs (weight×reps / reps / duration+distance / duration), previous-session numbers beside each set, warmup flag, rest timer (configurable, sound via Web Audio), finish summary (duration, volume, PRs hit).
- History: session list + detail + edit. Exercise detail now shows real history + PRs.
- Stats service: est. 1RM (Epley), PRs, weekly volume per muscle group, frequency — computed in SQL/service layer with unit tests.

**Verify:** lifecycle integration tests; stats unit tests with known fixtures (e.g. 100kg×5 → 1RM 116.7); manual phone walkthrough of a full logged workout; dashboard "Start today's workout" path once Phase 7 lands.

## Phase 6 — Food tracking

- `foods`, `food_log_entries` tables; food CRUD (soft delete); log CRUD; daily-summary endpoint (totals + per-meal, serving multipliers).
- Targets: per-user calorie/protein/carb/fat targets in settings.
- Daily log UI: date nav, four meal sections, add-food search (library + recents), serving multiplier, copy meal/day, totals vs. targets bars.
- Open Food Facts: server-side proxy `/api/lookup/off` (name + barcode search, 5s timeout, graceful failure); "import from lookup" pre-fills the new-food form; browser barcode scan via `@zxing/library` when in a secure context, typed barcode otherwise.

**Verify:** totals math tests (multipliers, rounding, per-meal vs. day); ownership tests; OFF proxy tested with mocked upstream (success, timeout, 404); manual: log a day of meals from a phone.

## Phase 7 — Dashboard & progress

- Dashboard: today's calories/macros vs. targets, today's planned workout (Start button) or last session summary, water quick-add, weight sparkline.
- Progress page (Recharts): weight trend, calories vs. target over time, per-exercise progression (top set / est. 1RM), weekly volume, water history.
- `body_metrics`, `water_log` tables + APIs + entry UIs (quick-add water buttons; weight/measurement form + table).

**Verify:** chart data-shaping unit tests (date bucketing, missing days); dashboard reflects seeded fixture data correctly; mobile layout check.

## Phase 8 — Polish & ship

- Settings polish (password change, units affect display + entry everywhere), admin backup download (SQLite online backup → stream), empty states, loading states, toasts, error envelope audit.
- README: features, screenshots, docker-compose quickstart, env vars, backup/restore.
- CI (GitHub Actions): typecheck, tests, Docker build + container smoke test (boot, setup, healthz).
- Version tagging + CHANGELOG.

**Verify:** full manual pass of every flow on desktop + phone viewport; fresh `docker compose up` from a clean folder through setup wizard to a logged workout and logged meal; all tests green in CI.

## Conventions (all phases)

- Zod validation on every request body; shared type definitions in `/shared` where practical.
- Every new API surface lands with its integration tests in the same phase.
- Soft-delete pattern for anything referenced by history.
- Commit at least once per phase; conventional-ish messages.
