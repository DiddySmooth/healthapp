import { Router } from "express";
import { and, asc, count, eq, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { exercises } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const logTypeEnum = z.enum(["strength", "bodyweight", "cardio", "duration"]);

const customSchema = z.object({
  name: z.string().min(1).max(100),
  logType: logTypeEnum,
  equipment: z.string().max(50).nullish(),
  primaryMuscles: z.array(z.string().max(30)).max(10).default([]),
  secondaryMuscles: z.array(z.string().max(30)).max(10).default([]),
  instructions: z.array(z.string().max(1000)).max(20).default([]),
});

const listQuery = z.object({
  search: z.string().max(100).optional(),
  muscle: z.string().max(30).optional(),
  equipment: z.string().max(50).optional(),
  logType: logTypeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export function exerciseRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  // Visible = bundled or owned by me, and not soft-deleted.
  const visibleTo = (userId: number) =>
    and(
      or(isNull(exercises.ownerId), eq(exercises.ownerId, userId)),
      eq(exercises.isDeleted, false),
    );

  router.get("/", (req, res) => {
    const q = parseBody(listQuery, req.query);
    const filters = [visibleTo(req.user!.id)];
    if (q.search) filters.push(like(exercises.name, `%${q.search}%`));
    if (q.equipment) filters.push(eq(exercises.equipment, q.equipment));
    if (q.logType) filters.push(eq(exercises.logType, q.logType));
    if (q.muscle) {
      // JSON arrays are stored as text; match the quoted string element.
      filters.push(
        sql`(${exercises.primaryMuscles} LIKE ${`%"${q.muscle}"%`} OR ${exercises.secondaryMuscles} LIKE ${`%"${q.muscle}"%`})`,
      );
    }
    const where = and(...filters);

    const total = db.select({ n: count() }).from(exercises).where(where).get()?.n ?? 0;
    const items = db
      .select()
      .from(exercises)
      .where(where)
      .orderBy(asc(exercises.name))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .all();

    res.json({ exercises: items, total, page: q.page, pageSize: q.pageSize });
  });

  // Distinct filter values for the library UI dropdowns.
  router.get("/meta", (req, res) => {
    const rows = db
      .select({
        equipment: exercises.equipment,
        primaryMuscles: exercises.primaryMuscles,
        secondaryMuscles: exercises.secondaryMuscles,
      })
      .from(exercises)
      .where(visibleTo(req.user!.id))
      .all();
    const equipment = [...new Set(rows.map((r) => r.equipment).filter(Boolean))].sort();
    const muscles = [
      ...new Set(rows.flatMap((r) => [...r.primaryMuscles, ...r.secondaryMuscles])),
    ].sort();
    res.json({ equipment, muscles });
  });

  router.get("/:id", (req, res) => {
    const ex = db
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, Number(req.params.id)), visibleTo(req.user!.id)))
      .get();
    if (!ex) throw new ApiError(404, "NOT_FOUND", "No such exercise");
    res.json({ exercise: ex });
  });

  router.post("/", (req, res) => {
    const input = parseBody(customSchema, req.body);
    const ex = db
      .insert(exercises)
      .values({ ...input, ownerId: req.user!.id })
      .returning()
      .get();
    res.status(201).json({ exercise: ex });
  });

  router.patch("/:id", (req, res) => {
    const ex = db
      .select()
      .from(exercises)
      .where(eq(exercises.id, Number(req.params.id)))
      .get();
    if (!ex || ex.isDeleted || ex.ownerId !== req.user!.id) {
      throw new ApiError(404, "NOT_FOUND", "No such custom exercise");
    }
    const patch = parseBody(customSchema.partial(), req.body);
    const updated = db
      .update(exercises)
      .set(patch)
      .where(eq(exercises.id, ex.id))
      .returning()
      .get();
    res.json({ exercise: updated });
  });

  router.delete("/:id", (req, res) => {
    const ex = db
      .select()
      .from(exercises)
      .where(eq(exercises.id, Number(req.params.id)))
      .get();
    if (!ex || ex.isDeleted || ex.ownerId !== req.user!.id) {
      throw new ApiError(404, "NOT_FOUND", "No such custom exercise");
    }
    db.update(exercises).set({ isDeleted: true }).where(eq(exercises.id, ex.id)).run();
    res.json({ ok: true });
  });

  return router;
}
