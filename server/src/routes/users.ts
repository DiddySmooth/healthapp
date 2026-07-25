import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import {
  createUser,
  findUserById,
  findUserByUsername,
  hashPassword,
  toPublicUser,
} from "../auth/service.js";
import type { Db } from "../db/index.js";
import { users } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";
import { passwordSchema, usernameSchema } from "./auth.js";

const createSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "user"]).default("user"),
});

const patchSchema = z.object({
  password: passwordSchema.optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export function userRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db), requireAdmin);

  router.get("/", (_req, res) => {
    const all = db.select().from(users).orderBy(asc(users.id)).all();
    res.json({ users: all.map(toPublicUser) });
  });

  router.post("/", (req, res) => {
    const input = parseBody(createSchema, req.body);
    if (findUserByUsername(db, input.username)) {
      throw new ApiError(409, "CONFLICT", "Username is already taken");
    }
    const user = createUser(db, input);
    res.status(201).json({ user: toPublicUser(user) });
  });

  router.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = Number.isInteger(id) ? findUserById(db, id) : undefined;
    if (!target) throw new ApiError(404, "NOT_FOUND", "No such user");
    const patch = parseBody(patchSchema, req.body);

    // An admin cannot deactivate or demote themselves — avoids locking
    // the instance out of admin access entirely.
    if (target.id === req.user!.id && (patch.isActive === false || patch.role === "user")) {
      throw new ApiError(400, "SELF_LOCKOUT", "You cannot deactivate or demote yourself");
    }

    const updated = db
      .update(users)
      .set({
        ...(patch.password != null ? { passwordHash: hashPassword(patch.password) } : {}),
        ...(patch.isActive != null ? { isActive: patch.isActive } : {}),
        ...(patch.role != null ? { role: patch.role } : {}),
      })
      .where(eq(users.id, target.id))
      .returning()
      .get();
    res.json({ user: toPublicUser(updated) });
  });

  return router;
}
