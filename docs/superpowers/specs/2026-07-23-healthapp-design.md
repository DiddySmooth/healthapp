# HealthApp — Self-Hosted Workout Planner & Calorie Tracker

**Date:** 2026-07-23
**Status:** Approved design

## Summary

A self-hosted fitness web app distributed as a single Docker image, in the style of Audiobookshelf: the user runs the container, opens the web UI, and completes a first-run setup wizard. It combines a workout planner/tracker (large exercise library, routines, calendar, live session logging, progression stats) with a calorie/macro tracker (personal food library, Open Food Facts lookup, daily log, goals), plus body weight, measurements, and water tracking. Responsive UI that works well on both phone and PC.

## Goals

- One-container deployment; all state in a single mounted `/data` volume (SQLite DB + uploads). Backup = copy the folder.
- Multi-user: an admin account created at first run; admin creates/manages additional users. Each user's data is private.
- Core app fully functional offline/LAN-only; internet is only used for optional food lookup.
- Mobile-friendly enough to comfortably log sets at the gym and meals from a phone.

## Non-Goals (v1)

- No public registration, OAuth, or reverse-proxy auth integration.
- No native mobile app (responsive web only) and no offline PWA sync.
- No social features, coaching, or AI recommendations.
- No wearable/HealthKit/Google Fit integrations.
- No light theme — dark theme only.

## Architecture

Monorepo, single container:

```
/client   React 18 + Vite + TypeScript SPA
/server   Express + TypeScript API
/data     (runtime volume) healthapp.db, uploads/
```

- Multi-stage Dockerfile: build client → build server → slim Node runtime image. Express serves the API under `/api/*` and the built SPA (static files + history fallback) on one port (default **3420**).
- Database: SQLite via better-sqlite3 + Drizzle ORM (typed schema, versioned migrations run automatically on startup). WAL mode enabled.
- Auth: `express-session` with a SQLite-backed session store; httpOnly, SameSite=Lax cookies; bcrypt password hashing.
- The bundled exercise dataset (free-exercise-db, ~870 exercises: names, primary/secondary muscles, equipment, category, instructions, images) is seeded into the DB on first startup; exercise images ship in the image and are served statically.

### Frontend stack

- React Router for navigation; TanStack Query for server state; Tailwind CSS for styling; Recharts for charts.
- Layout: top navbar (Dashboard, Workouts, Food, Progress, Settings) collapsing to a hamburger menu on small screens.
- Visual style: dark theme — slate background (`#0f172a` family), card surfaces, neon cyan/violet/amber accents.

## Users & Auth

- **First-run setup wizard**: create admin account (username/password), choose default units (lbs/kg, mi/km) and timezone.
- **Roles**: `admin` and `user`. Admin can create users, reset passwords, deactivate accounts, and change instance settings. Admin does not see other users' logs.
- **Per-user settings**: units, daily calorie/macro targets, daily water target, week start day.
- Login page → session cookie; API rejects unauthenticated requests with 401; SPA redirects to login.

## Data Model (core tables)

- `users` — id, username, password_hash, role, is_active, settings JSON (units, week start), created_at
- `exercises` — id, owner_id (null = bundled), name, category (strength | cardio | bodyweight | duration), primary_muscles, secondary_muscles, equipment, instructions, image paths, is_deleted (soft delete)
- `routines` — id, user_id, name, description, is_archived
- `routine_exercises` — routine_id, exercise_id, position, target_sets, target_reps, target_weight, target_duration, target_distance, notes
- `schedule` — id, user_id, routine_id, either weekday (recurring) or date (one-off)
- `workout_sessions` — id, user_id, routine_id (nullable), started_at, finished_at, notes
- `session_exercises` — session_id, exercise_id, position, notes
- `sets` — session_exercise_id, position, weight, reps, duration_sec, distance, is_warmup, completed
- `foods` — id, user_id, name, brand, barcode, serving_size, serving_unit, calories, protein, carbs, fat, fiber, sugar, sodium (soft delete)
- `food_log_entries` — id, user_id, food_id, date, meal (breakfast | lunch | dinner | snack), servings
- `body_metrics` — id, user_id, date, type (weight | waist | chest | arm | …), value
- `water_log` — id, user_id, date, amount_ml

Set fields are nullable and used according to the exercise category (strength: weight+reps; bodyweight: reps + optional added weight; cardio: duration+distance; duration: duration only).

## Features

### Dashboard (home)

- Today's calories: consumed vs. target with progress bar and macro breakdown (protein/carbs/fat).
- Today's planned workout (from schedule) with a "Start" button; or last workout summary.
- Water quick-add buttons; current body weight with mini trend sparkline.

### Workouts

- **Exercise library**: search + filter by muscle group, equipment, category; exercise detail page with instructions, images, personal history, and PRs. "Create custom exercise" per user.
- **Routines**: CRUD; ordered exercises with targets; duplicate routine.
- **Calendar**: month/week view; assign routines to weekdays (recurring) or dates; shows completed sessions.
- **Live session**: start from routine (targets + previous session's numbers pre-filled per set) or freeform; check off sets, add/remove sets/exercises mid-session; optional per-exercise rest timer with notification sound; finish → summary (duration, volume, PRs hit).
- **History**: list of past sessions; session detail; edit past sessions.
- **Stats**: PRs (max weight, best est. 1RM via Epley, max reps), volume per muscle group per week, frequency.

### Food

- **Daily log**: date navigation; meals (breakfast/lunch/dinner/snacks); add via search of personal library + recent foods; serving multiplier; copy meal/day from a previous date; daily totals vs. targets.
- **Food library**: CRUD foods with full macro fields; entered once, reused forever.
- **Lookup assist**: search Open Food Facts by name or barcode (using phone camera via a JS barcode-scanning library where supported, or typed barcode) to pre-fill a new food's nutrition; result is saved locally so future use is offline. Lookup failures degrade to manual entry with a non-blocking message.
- **Goals**: per-user daily calorie + macro targets (grams), editable in settings.

### Progress

- Charts: body weight trend, calories vs. target over time, per-exercise strength progression (top set / est. 1RM), weekly training volume, water intake.
- Body metrics log: add weight/measurements; table + chart views.

### Settings / Admin

- User settings: units, targets, password change.
- Admin panel: user management (create, reset password, deactivate), instance info, DB backup download (streams a consistent SQLite backup).

## API Shape (sketch)

REST JSON under `/api`: `/api/auth/*` (login, logout, me, setup), `/api/users` (admin), `/api/exercises`, `/api/routines`, `/api/schedule`, `/api/sessions` (+ nested sets), `/api/foods`, `/api/food-log`, `/api/metrics`, `/api/water`, `/api/stats/*`, `/api/lookup/off` (server-side proxy to Open Food Facts to avoid CORS). Consistent error envelope `{ error: { code, message } }`.

## Error Handling

- Central Express error middleware → consistent JSON errors; client shows toast notifications.
- Zod validation on all request bodies (shared types between client/server where practical).
- Soft deletes for exercises/foods referenced by history; hard delete only when unreferenced.
- Open Food Facts proxy has a short timeout and clear "lookup unavailable" response; never blocks core flows.

## Testing

- **Server**: Vitest integration tests against an in-memory/temp SQLite DB covering auth, permissions (user A cannot read user B's data), workout session lifecycle, food log math (serving multipliers, daily totals), and stats calculations (1RM, volume, streaks).
- **Client**: React Testing Library for high-value components (set logger, food search/add flow, daily totals display).
- **Container**: CI builds the Docker image and runs a smoke test (start container, run setup, hit health endpoint).

## Deployment

```yaml
services:
  healthapp:
    image: healthapp:latest
    ports: ["3420:3420"]
    volumes: ["./data:/data"]
    restart: unless-stopped
```

- `GET /healthz` for container health checks.
- Semver-tagged images; DB migrations run automatically on upgrade.

## Build Order (suggested)

1. Scaffold monorepo, Docker build, Express + SQLite + migrations, health endpoint.
2. Auth + first-run setup wizard + user admin.
3. Exercise library (seed dataset, browse/search, custom exercises).
4. Routines + calendar.
5. Live session logging + history.
6. Food library + daily log + goals (+ OFF lookup).
7. Dashboard, progress charts, stats.
8. Water + body metrics, settings polish, backup download.
