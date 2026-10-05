import { Router } from "express";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { foodLogEntries, foods, workoutSessions } from "../db/schema.js";
import { exerciseHistory, exercisePRs, volumeByMuscle } from "../lib/stats.js";

export function statsRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  router.get("/exercise/:exerciseId", (req, res) => {
    const exerciseId = Number(req.params.exerciseId);
    res.json({
      history: exerciseHistory(db, req.user!.id, exerciseId),
      prs: exercisePRs(db, req.user!.id, exerciseId),
    });
  });

  // Finished workouts per calendar day (in the user's timezone) for the
  // last N days — feeds the contribution-style heatmap.
  router.get("/workout-days", (req, res) => {
    const days = Math.min(730, Math.max(1, Number(req.query.days ?? 365)));
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat("sv", {
        timeZone: req.user!.settings.timezone || "UTC",
      });
    } catch {
      fmt = new Intl.DateTimeFormat("sv", { timeZone: "UTC" });
    }
    const rows = db
      .select({ startedAt: workoutSessions.startedAt })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, req.user!.id),
          isNotNull(workoutSessions.finishedAt),
        ),
      )
      .all();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const date = fmt.format(row.startedAt);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    const result: { date: string; count: number }[] = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const date = fmt.format(new Date(now - i * 86_400_000));
      // DST shifts can repeat a local date when stepping in UTC days.
      if (result[result.length - 1]?.date === date) continue;
      result.push({ date, count: counts.get(date) ?? 0 });
    }
    res.json({ days: result });
  });

  // Daily calorie totals for the last N days.
  router.get("/calories", (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)));
    const rows = db
      .select({ entry: foodLogEntries, food: foods })
      .from(foodLogEntries)
      .innerJoin(foods, eq(foodLogEntries.foodId, foods.id))
      .where(eq(foodLogEntries.userId, req.user!.id))
      .all();
    const byDate = new Map<string, number>();
    for (const { entry, food } of rows) {
      byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + food.calories * entry.servings);
    }
    const result: { date: string; calories: number }[] = [];
    const cursor = new Date();
    for (let i = 0; i < days; i++) {
      const iso = cursor.toLocaleDateString("sv");
      result.unshift({ date: iso, calories: Math.round(byDate.get(iso) ?? 0) });
      cursor.setDate(cursor.getDate() - 1);
    }
    res.json({ days: result });
  });

  // Weekly training volume for the last N weeks (total + per muscle).
  router.get("/volume", (req, res) => {
    const weeks = Math.min(52, Math.max(1, Number(req.query.weeks ?? 8)));
    const weekStartsMonday =
      (req.user!.settings.weekStart ?? "monday") === "monday";

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const offset = weekStartsMonday ? (start.getDay() + 6) % 7 : start.getDay();
    start.setDate(start.getDate() - offset);

    const result: {
      weekStart: string;
      total: number;
      byMuscle: Record<string, number>;
    }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const from = new Date(start);
      from.setDate(from.getDate() - i * 7);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const byMuscle = volumeByMuscle(db, req.user!.id, from, to);
      result.push({
        weekStart: from.toLocaleDateString("sv"),
        total: Math.round(Object.values(byMuscle).reduce((s, v) => s + v, 0)),
        byMuscle,
      });
    }
    res.json({ weeks: result });
  });

  return router;
}
