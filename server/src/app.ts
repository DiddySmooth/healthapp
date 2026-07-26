import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import session from "express-session";
import { eq } from "drizzle-orm";
import { SqliteSessionStore } from "./auth/store.js";
import { config } from "./config.js";
import type { Db } from "./db/index.js";
import { appMeta } from "./db/schema.js";
import { exerciseDbDir } from "./db/seed.js";
import { errorHandler } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { foodLogRoutes } from "./routes/foodlog.js";
import { foodRoutes } from "./routes/foods.js";
import { lookupRoutes, type FetchLike } from "./routes/lookup.js";
import { routineRoutes } from "./routes/routines.js";
import { scheduleRoutes } from "./routes/schedule.js";
import { sessionRoutes } from "./routes/sessions.js";
import { statsRoutes } from "./routes/stats.js";
import { userRoutes } from "./routes/users.js";

// The session secret is generated once per instance and persisted so
// sessions survive container restarts.
function sessionSecret(db: Db): string {
  const existing = db
    .select()
    .from(appMeta)
    .where(eq(appMeta.key, "session_secret"))
    .get();
  if (existing) return existing.value;
  const secret = crypto.randomBytes(32).toString("hex");
  db.insert(appMeta).values({ key: "session_secret", value: secret }).run();
  return secret;
}

export function buildApp(
  db: Db,
  clientDist: string = config.clientDist,
  options: { offFetch?: FetchLike } = {},
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json());

  app.use(
    session({
      name: "healthapp.sid",
      secret: sessionSecret(db),
      store: new SqliteSessionStore(db),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes(db));
  app.use("/api/users", userRoutes(db));
  app.use("/api/exercises", exerciseRoutes(db));
  app.use("/api/routines", routineRoutes(db));
  app.use("/api/schedule", scheduleRoutes(db));
  app.use("/api/sessions", sessionRoutes(db));
  app.use("/api/stats", statsRoutes(db));
  app.use("/api/foods", foodRoutes(db));
  app.use("/api/food-log", foodLogRoutes(db));
  app.use("/api/lookup", lookupRoutes(db, options.offFetch));

  // Bundled exercise images (immutable dataset — cache hard).
  app.use(
    "/exercise-images",
    express.static(path.join(exerciseDbDir, "images"), {
      maxAge: "30d",
      immutable: true,
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown API route" } });
  });

  app.use(errorHandler);

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA history fallback for non-API GET requests.
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
