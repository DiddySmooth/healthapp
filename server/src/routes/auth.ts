import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import {
  createUser,
  findUserByUsername,
  hashPassword,
  toPublicUser,
  userCount,
  verifyPassword,
} from "../auth/service.js";
import type { Db } from "../db/index.js";
import { users } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, and _ . - allowed");
export const passwordSchema = z.string().min(8).max(128);

export const settingsSchema = z.object({
  weightUnit: z.enum(["lbs", "kg"]),
  distanceUnit: z.enum(["mi", "km"]),
  timezone: z.string().min(1).max(64),
  weekStart: z.enum(["monday", "sunday"]),
  calorieTarget: z.number().min(0).max(20000).nullable(),
  proteinTarget: z.number().min(0).max(2000).nullable(),
  carbsTarget: z.number().min(0).max(3000).nullable(),
  fatTarget: z.number().min(0).max(1000).nullable(),
  waterTargetMl: z.number().min(0).max(20000).nullable(),
});

const setupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  settings: settingsSchema.partial().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function authRoutes(db: Db): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    res.json({ needsSetup: userCount(db) === 0 });
  });

  // First-run: create the admin account. Only works while no users exist.
  router.post("/setup", (req, res) => {
    if (userCount(db) > 0) {
      throw new ApiError(403, "SETUP_DONE", "Setup has already been completed");
    }
    const input = parseBody(setupSchema, req.body);
    const user = createUser(db, { ...input, role: "admin" });
    req.session.userId = user.id;
    res.status(201).json({ user: toPublicUser(user) });
  });

  router.post("/login", (req, res) => {
    const input = parseBody(loginSchema, req.body);
    const user = findUserByUsername(db, input.username);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new ApiError(401, "BAD_CREDENTIALS", "Invalid username or password");
    }
    if (!user.isActive) {
      throw new ApiError(403, "DEACTIVATED", "This account has been deactivated");
    }
    req.session.userId = user.id;
    res.json({ user: toPublicUser(user) });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("healthapp.sid");
      res.json({ ok: true });
    });
  });

  router.get("/me", requireAuth(db), (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  });

  router.post("/password", requireAuth(db), (req, res) => {
    const input = parseBody(
      z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
      req.body,
    );
    if (!verifyPassword(input.currentPassword, req.user!.passwordHash)) {
      throw new ApiError(403, "BAD_CREDENTIALS", "Current password is incorrect");
    }
    db.update(users)
      .set({ passwordHash: hashPassword(input.newPassword) })
      .where(eq(users.id, req.user!.id))
      .run();
    res.json({ ok: true });
  });

  router.patch("/me/settings", requireAuth(db), (req, res) => {
    const patch = parseBody(settingsSchema.partial(), req.body);
    const updated = db
      .update(users)
      .set({ settings: { ...req.user!.settings, ...patch } })
      .where(eq(users.id, req.user!.id))
      .returning()
      .get();
    res.json({ user: toPublicUser(updated) });
  });

  return router;
}
