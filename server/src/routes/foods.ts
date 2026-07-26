import { Router } from "express";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { foodLogEntries, foods, type Food } from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const foodSchema = z.object({
  name: z.string().min(1).max(150),
  brand: z.string().max(100).nullish(),
  barcode: z.string().max(64).nullish(),
  servingSize: z.number().positive().max(100000).default(1),
  servingUnit: z.string().min(1).max(30).default("serving"),
  calories: z.number().min(0).max(100000),
  protein: z.number().min(0).max(10000).default(0),
  carbs: z.number().min(0).max(10000).default(0),
  fat: z.number().min(0).max(10000).default(0),
  fiber: z.number().min(0).max(10000).nullish(),
  sugar: z.number().min(0).max(10000).nullish(),
  sodium: z.number().min(0).max(1000000).nullish(),
});

export function foodRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  function ownedFood(userId: number, id: number): Food {
    const food = db
      .select()
      .from(foods)
      .where(and(eq(foods.id, id), eq(foods.userId, userId), eq(foods.isDeleted, false)))
      .get();
    if (!food) throw new ApiError(404, "NOT_FOUND", "No such food");
    return food;
  }

  router.get("/", (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const filters = [eq(foods.userId, req.user!.id), eq(foods.isDeleted, false)];
    if (search) filters.push(like(foods.name, `%${search}%`));
    const list = db
      .select()
      .from(foods)
      .where(and(...filters))
      .orderBy(foods.name)
      .limit(100)
      .all();
    res.json({ foods: list });
  });

  // Foods from the user's most recent log entries — the quick-add list.
  router.get("/recent", (req, res) => {
    const entries = db
      .select({ foodId: foodLogEntries.foodId })
      .from(foodLogEntries)
      .where(eq(foodLogEntries.userId, req.user!.id))
      .orderBy(desc(foodLogEntries.id))
      .limit(100)
      .all();
    const seen: number[] = [];
    for (const e of entries) {
      if (!seen.includes(e.foodId)) seen.push(e.foodId);
      if (seen.length >= 10) break;
    }
    const list =
      seen.length > 0
        ? db
            .select()
            .from(foods)
            .where(and(inArray(foods.id, seen), eq(foods.isDeleted, false)))
            .all()
        : [];
    // Preserve recency order.
    list.sort((a, b) => seen.indexOf(a.id) - seen.indexOf(b.id));
    res.json({ foods: list });
  });

  router.post("/", (req, res) => {
    const input = parseBody(foodSchema, req.body);
    const food = db
      .insert(foods)
      .values({ ...input, userId: req.user!.id })
      .returning()
      .get();
    res.status(201).json({ food });
  });

  router.patch("/:id", (req, res) => {
    const food = ownedFood(req.user!.id, Number(req.params.id));
    const patch = parseBody(foodSchema.partial(), req.body);
    const updated = db
      .update(foods)
      .set(patch)
      .where(eq(foods.id, food.id))
      .returning()
      .get();
    res.json({ food: updated });
  });

  router.delete("/:id", (req, res) => {
    const food = ownedFood(req.user!.id, Number(req.params.id));
    db.update(foods).set({ isDeleted: true }).where(eq(foods.id, food.id)).run();
    res.json({ ok: true });
  });

  return router;
}
