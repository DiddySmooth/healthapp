import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { foodLogEntries, foods, type Food, type FoodLogEntry } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const mealSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const createSchema = z.object({
  foodId: z.number().int().positive(),
  date: dateSchema,
  meal: mealSchema,
  servings: z.number().positive().max(1000).default(1),
});

const patchSchema = z.object({
  servings: z.number().positive().max(1000).optional(),
  meal: mealSchema.optional(),
  date: dateSchema.optional(),
});

const copySchema = z.object({
  fromDate: dateSchema,
  toDate: dateSchema,
  meal: mealSchema.optional(),
});

export type EntryWithFood = FoodLogEntry & { food: Food };

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function entryMacros(entry: FoodLogEntry, food: Food): MacroTotals {
  return {
    calories: round1(food.calories * entry.servings),
    protein: round1(food.protein * entry.servings),
    carbs: round1(food.carbs * entry.servings),
    fat: round1(food.fat * entry.servings),
  };
}

function sumTotals(items: MacroTotals[]): MacroTotals {
  return {
    calories: round1(items.reduce((s, i) => s + i.calories, 0)),
    protein: round1(items.reduce((s, i) => s + i.protein, 0)),
    carbs: round1(items.reduce((s, i) => s + i.carbs, 0)),
    fat: round1(items.reduce((s, i) => s + i.fat, 0)),
  };
}

export function foodLogRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  function dayEntries(userId: number, date: string) {
    return db
      .select({ entry: foodLogEntries, food: foods })
      .from(foodLogEntries)
      .innerJoin(foods, eq(foodLogEntries.foodId, foods.id))
      .where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.date, date)))
      .orderBy(asc(foodLogEntries.id))
      .all();
  }

  function ownedEntry(userId: number, id: number): FoodLogEntry {
    const entry = db
      .select()
      .from(foodLogEntries)
      .where(and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)))
      .get();
    if (!entry) throw new ApiError(404, "NOT_FOUND", "No such log entry");
    return entry;
  }

  router.get("/day/:date", (req, res) => {
    const date = parseBody(dateSchema, req.params.date);
    const rows = dayEntries(req.user!.id, date);
    const entries = rows.map((r) => ({
      ...r.entry,
      food: r.food,
      macros: entryMacros(r.entry, r.food),
    }));
    const meals: Record<string, MacroTotals> = {};
    for (const meal of ["breakfast", "lunch", "dinner", "snack"]) {
      meals[meal] = sumTotals(
        entries.filter((e) => e.meal === meal).map((e) => e.macros),
      );
    }
    res.json({
      date,
      entries,
      meals,
      totals: sumTotals(entries.map((e) => e.macros)),
    });
  });

  router.post("/", (req, res) => {
    const input = parseBody(createSchema, req.body);
    const food = db
      .select()
      .from(foods)
      .where(
        and(
          eq(foods.id, input.foodId),
          eq(foods.userId, req.user!.id),
          eq(foods.isDeleted, false),
        ),
      )
      .get();
    if (!food) throw new ApiError(400, "VALIDATION", "Unknown food");
    const entry = db
      .insert(foodLogEntries)
      .values({ ...input, userId: req.user!.id })
      .returning()
      .get();
    res.status(201).json({ entry: { ...entry, food, macros: entryMacros(entry, food) } });
  });

  router.patch("/:id", (req, res) => {
    const entry = ownedEntry(req.user!.id, Number(req.params.id));
    const patch = parseBody(patchSchema, req.body);
    const updated = db
      .update(foodLogEntries)
      .set(patch)
      .where(eq(foodLogEntries.id, entry.id))
      .returning()
      .get();
    res.json({ entry: updated });
  });

  router.delete("/:id", (req, res) => {
    const entry = ownedEntry(req.user!.id, Number(req.params.id));
    db.delete(foodLogEntries).where(eq(foodLogEntries.id, entry.id)).run();
    res.json({ ok: true });
  });

  // Copy a previous day's entries (optionally one meal) onto another day.
  router.post("/copy", (req, res) => {
    const input = parseBody(copySchema, req.body);
    const rows = dayEntries(req.user!.id, input.fromDate).filter(
      (r) => input.meal == null || r.entry.meal === input.meal,
    );
    if (rows.length === 0) {
      throw new ApiError(400, "EMPTY", "Nothing to copy from that day");
    }
    db.transaction((tx) => {
      for (const r of rows) {
        tx.insert(foodLogEntries)
          .values({
            userId: req.user!.id,
            foodId: r.entry.foodId,
            date: input.toDate,
            meal: r.entry.meal,
            servings: r.entry.servings,
          })
          .run();
      }
    });
    res.status(201).json({ copied: rows.length });
  });

  return router;
}
