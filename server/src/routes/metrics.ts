import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { bodyMetrics, metricTypes, waterLog } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const metricSchema = z.object({
  date: dateSchema,
  type: z.enum(metricTypes),
  value: z.number().positive().max(10000),
});

export function metricRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  router.get("/", (req, res) => {
    const type = String(req.query.type ?? "");
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit ?? 365)));
    const filters = [eq(bodyMetrics.userId, req.user!.id)];
    if (type) {
      const parsed = z.enum(metricTypes).safeParse(type);
      if (!parsed.success) throw new ApiError(400, "VALIDATION", "Unknown metric type");
      filters.push(eq(bodyMetrics.type, parsed.data));
    }
    const metrics = db
      .select()
      .from(bodyMetrics)
      .where(and(...filters))
      .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.id))
      .limit(limit)
      .all();
    res.json({ metrics });
  });

  router.post("/", (req, res) => {
    const input = parseBody(metricSchema, req.body);
    const metric = db
      .insert(bodyMetrics)
      .values({ ...input, userId: req.user!.id })
      .returning()
      .get();
    res.status(201).json({ metric });
  });

  router.delete("/:id", (req, res) => {
    const metric = db
      .select()
      .from(bodyMetrics)
      .where(
        and(eq(bodyMetrics.id, Number(req.params.id)), eq(bodyMetrics.userId, req.user!.id)),
      )
      .get();
    if (!metric) throw new ApiError(404, "NOT_FOUND", "No such metric");
    db.delete(bodyMetrics).where(eq(bodyMetrics.id, metric.id)).run();
    res.json({ ok: true });
  });

  return router;
}

const waterSchema = z.object({
  date: dateSchema,
  amountMl: z.number().int().min(1).max(10000),
});

export function waterRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  router.get("/day/:date", (req, res) => {
    const date = parseBody(dateSchema, req.params.date);
    const entries = db
      .select()
      .from(waterLog)
      .where(and(eq(waterLog.userId, req.user!.id), eq(waterLog.date, date)))
      .orderBy(asc(waterLog.id))
      .all();
    res.json({ date, entries, totalMl: entries.reduce((s, e) => s + e.amountMl, 0) });
  });

  // Daily totals for the last N days (charting).
  router.get("/history", (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 14)));
    const rows = db
      .select()
      .from(waterLog)
      .where(eq(waterLog.userId, req.user!.id))
      .all();
    const byDate = new Map<string, number>();
    for (const row of rows) {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.amountMl);
    }
    const result: { date: string; totalMl: number }[] = [];
    const cursor = new Date();
    for (let i = 0; i < days; i++) {
      const iso = cursor.toLocaleDateString("sv");
      result.unshift({ date: iso, totalMl: byDate.get(iso) ?? 0 });
      cursor.setDate(cursor.getDate() - 1);
    }
    res.json({ days: result });
  });

  router.post("/", (req, res) => {
    const input = parseBody(waterSchema, req.body);
    const entry = db
      .insert(waterLog)
      .values({ ...input, userId: req.user!.id })
      .returning()
      .get();
    res.status(201).json({ entry });
  });

  router.delete("/:id", (req, res) => {
    const entry = db
      .select()
      .from(waterLog)
      .where(and(eq(waterLog.id, Number(req.params.id)), eq(waterLog.userId, req.user!.id)))
      .get();
    if (!entry) throw new ApiError(404, "NOT_FOUND", "No such entry");
    db.delete(waterLog).where(eq(waterLog.id, entry.id)).run();
    res.json({ ok: true });
  });

  return router;
}
