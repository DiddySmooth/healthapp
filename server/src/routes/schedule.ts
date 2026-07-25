import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { routines, schedule } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const entrySchema = z
  .object({
    routineId: z.number().int().positive(),
    weekday: z.number().int().min(0).max(6).nullish(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
      .nullish(),
  })
  .refine((e) => (e.weekday != null) !== (e.date != null), {
    message: "Provide exactly one of weekday or date",
  });

export function scheduleRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  router.get("/", (req, res) => {
    const entries = db
      .select()
      .from(schedule)
      .where(eq(schedule.userId, req.user!.id))
      .all();
    res.json({ entries });
  });

  router.post("/", (req, res) => {
    const input = parseBody(entrySchema, req.body);
    const routine = db
      .select()
      .from(routines)
      .where(and(eq(routines.id, input.routineId), eq(routines.userId, req.user!.id)))
      .get();
    if (!routine) throw new ApiError(400, "VALIDATION", "Unknown routine");
    const entry = db
      .insert(schedule)
      .values({
        userId: req.user!.id,
        routineId: input.routineId,
        weekday: input.weekday ?? null,
        date: input.date ?? null,
      })
      .returning()
      .get();
    res.status(201).json({ entry });
  });

  router.delete("/:id", (req, res) => {
    const entry = db
      .select()
      .from(schedule)
      .where(
        and(eq(schedule.id, Number(req.params.id)), eq(schedule.userId, req.user!.id)),
      )
      .get();
    if (!entry) throw new ApiError(404, "NOT_FOUND", "No such schedule entry");
    db.delete(schedule).where(eq(schedule.id, entry.id)).run();
    res.json({ ok: true });
  });

  return router;
}
