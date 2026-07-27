# HealthApp

[![CI](https://github.com/DiddySmooth/healthapp/actions/workflows/ci.yml/badge.svg)](https://github.com/DiddySmooth/healthapp/actions/workflows/ci.yml)

A self-hosted workout planner/tracker and calorie counter, in the spirit of
Audiobookshelf: run one Docker container, open the web UI, create your admin
account, done. All data stays on your server in a single mounted folder.

Works great on both desktop and phone (responsive dark UI).

## Features

**Workouts**
- Exercise library with **873 bundled exercises** (photos, muscle groups,
  equipment, instructions — from the public-domain
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db)), plus your
  own custom exercises
- Reusable **routines** with per-exercise targets (sets × reps × weight,
  duration, distance)
- **Calendar**: schedule routines on recurring weekdays or specific dates
- **Live session logging**: pre-filled targets, last-time hints next to every
  set, rest timer with beep, warmup sets, freeform additions mid-workout
- **History & stats**: session log with volume, per-exercise personal records
  (heaviest set, best estimated 1RM, most reps) and progression charts

**Nutrition**
- Personal **food library**: enter a food's macros once, log it forever
- **Daily log** with four meals, serving multipliers, copy-from-yesterday,
  and calorie/protein/carbs/fat progress bars against your targets
- Optional **Open Food Facts lookup** (name or barcode) to pre-fill nutrition —
  the only feature that touches the internet; everything else is fully offline

**More**
- Dashboard: today's calories, scheduled workout, water quick-add, body weight
- Progress charts: weight trend, calories vs. target, strength progression,
  weekly training volume, water
- Body measurements log (waist, chest, arms, body fat, …)
- **Multi-user**: admin creates accounts; each user's data is private
- Admin: user management, password resets, one-click database backup download

## Quick start

```yaml
# docker-compose.yml
services:
  healthapp:
    image: ghcr.io/diddysmooth/healthapp:latest
    ports:
      - "3420:3420"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open `http://your-server:3420`, and the first-run wizard will ask you to create
the admin account and pick your units and timezone.

To build the image from source instead:

```bash
git clone https://github.com/DiddySmooth/healthapp.git && cd healthapp
docker compose up -d --build
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3420` | HTTP port inside the container |
| `DATA_DIR` | `/data` | Where the SQLite DB lives (mount this!) |

Sessions, users, logs — everything — live in `DATA_DIR/healthapp.db`.
Database migrations run automatically on upgrade; just pull the new image and
restart.

## Backup & restore

- **Backup**: Settings → Backup → *Download database backup* (admin), or simply
  copy the mounted `./data` folder.
- **Restore**: stop the container, replace `./data/healthapp.db` with your
  backup, start the container.

## Notes for reverse proxies / HTTPS

The app works fine on plain HTTP inside your LAN. The one exception is the
**📷 Scan** button (camera barcode scanning): browsers only allow camera
access in a secure context, so it needs HTTPS — any reverse proxy (Caddy,
Traefik, nginx) with a certificate in front works, and `trust proxy` is
already enabled. On plain HTTP the scan button explains this and you can
still type barcodes manually.

## Development

```bash
npm install
npm run dev        # server on :3420, Vite client on :5173
npm test           # server integration tests (in-memory SQLite)
npm run typecheck  # both workspaces
```

Repo layout: `client/` (React 18 + Vite + Tailwind), `server/` (Express +
Drizzle + better-sqlite3), one multi-stage `Dockerfile` that serves the built
client and the API from a single port.

## License

Application code: [MIT](LICENSE). Bundled exercise dataset and images are public domain
([Unlicense](server/exercise-db/LICENSE.md)) from free-exercise-db. Food
lookups are powered by [Open Food Facts](https://world.openfoodfacts.org)
(Open Database License).
