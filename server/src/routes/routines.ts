import { Router } from "express";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import {
  exercises,
  routineExercises,
  routines,
  type Routine,
  type RoutineExercise,
} from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const routineExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  targetSets: z.number().int().min(1).max(50).nullish(),
  targetReps: z.number().int().min(1).max(1000).nullish(),
  targetWeight: z.number().min(0).max(5000).nullish(),
  targetDurationSec: z.number().int().min(1).max(86400).nullish(),
  targetDistance: z.number().min(0).max(1000).nullish(),
  notes: z.string().max(500).nullish(),
});

const routineSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullish(),
  isArchived: z.boolean().optional(),
  exercises: z.array(routineExerciseSchema).max(50).default([]),
});

type ExerciseSummary = {
  id: number;
  name: string;
  logType: string;
  images: string[];
};
type RoutineExerciseWithInfo = RoutineExercise & { exercise: ExerciseSummary };

export type RoutineWithExercises = Routine & { exercises: RoutineExerciseWithInfo[] };

function loadExercises(
  db: Db,
  routineIds: number[],
): Map<number, RoutineExerciseWithInfo[]> {
  const map = new Map<number, RoutineExerciseWithInfo[]>();
  if (routineIds.length === 0) return map;
  const rows = db
    .select({
      re: routineExercises,
      exercise: {
        id: exercises.id,
        name: exercises.name,
        logType: exercises.logType,
        images: exercises.images,
      },
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(inArray(routineExercises.routineId, routineIds))
    .orderBy(asc(routineExercises.position))
    .all();
  for (const row of rows) {
    const list = map.get(row.re.routineId) ?? [];
    list.push({ ...row.re, exercise: row.exercise });
    map.set(row.re.routineId, list);
  }
  return map;
}

export function routineRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  function ownedRoutine(req: { user?: { id: number } }, id: number): Routine {
    const routine = db
      .select()
      .from(routines)
      .where(and(eq(routines.id, id), eq(routines.userId, req.user!.id)))
      .get();
    if (!routine) throw new ApiError(404, "NOT_FOUND", "No such routine");
    return routine;
  }

  // All exercise ids must be visible to this user (bundled or own).
  function assertExercisesVisible(userId: number, ids: number[]): void {
    if (ids.length === 0) return;
    const visible = db
      .select({ id: exercises.id })
      .from(exercises)
      .where(
        and(
          inArray(exercises.id, ids),
          or(isNull(exercises.ownerId), eq(exercises.ownerId, userId)),
          eq(exercises.isDeleted, false),
        ),
      )
      .all();
    if (visible.length !== new Set(ids).size) {
      throw new ApiError(400, "VALIDATION", "Unknown exercise in routine");
    }
  }

  function replaceExercises(
    routineId: number,
    items: z.output<typeof routineExerciseSchema>[],
  ): void {
    db.delete(routineExercises).where(eq(routineExercises.routineId, routineId)).run();
    items.forEach((item, position) => {
      db.insert(routineExercises)
        .values({ ...item, routineId, position })
        .run();
    });
  }

  router.get("/", (req, res) => {
    const list = db
      .select()
      .from(routines)
      .where(eq(routines.userId, req.user!.id))
      .orderBy(asc(routines.name))
      .all();
    const byRoutine = loadExercises(
      db,
      list.map((r) => r.id),
    );
    res.json({
      routines: list.map((r) => ({ ...r, exercises: byRoutine.get(r.id) ?? [] })),
    });
  });

  router.get("/:id", (req, res) => {
    const routine = ownedRoutine(req, Number(req.params.id));
    const byRoutine = loadExercises(db, [routine.id]);
    res.json({ routine: { ...routine, exercises: byRoutine.get(routine.id) ?? [] } });
  });

  router.post("/", (req, res) => {
    const input = parseBody(routineSchema, req.body);
    assertExercisesVisible(
      req.user!.id,
      input.exercises.map((e) => e.exerciseId),
    );
    const routine = db
      .insert(routines)
      .values({
        userId: req.user!.id,
        name: input.name,
        description: input.description ?? null,
      })
      .returning()
      .get();
    db.transaction(() => replaceExercises(routine.id, input.exercises));
    const byRoutine = loadExercises(db, [routine.id]);
    res
      .status(201)
      .json({ routine: { ...routine, exercises: byRoutine.get(routine.id) ?? [] } });
  });

  router.put("/:id", (req, res) => {
    const existing = ownedRoutine(req, Number(req.params.id));
    const input = parseBody(routineSchema, req.body);
    assertExercisesVisible(
      req.user!.id,
      input.exercises.map((e) => e.exerciseId),
    );
    const updated = db
      .update(routines)
      .set({
        name: input.name,
        description: input.description ?? null,
        isArchived: input.isArchived ?? existing.isArchived,
      })
      .where(eq(routines.id, existing.id))
      .returning()
      .get();
    db.transaction(() => replaceExercises(existing.id, input.exercises));
    const byRoutine = loadExercises(db, [existing.id]);
    res.json({ routine: { ...updated, exercises: byRoutine.get(existing.id) ?? [] } });
  });

  router.post("/:id/duplicate", (req, res) => {
    const source = ownedRoutine(req, Number(req.params.id));
    const items = loadExercises(db, [source.id]).get(source.id) ?? [];
    const copy = db
      .insert(routines)
      .values({
        userId: req.user!.id,
        name: `${source.name} (copy)`,
        description: source.description,
      })
      .returning()
      .get();
    db.transaction(() =>
      replaceExercises(
        copy.id,
        items.map(
          ({ id: _id, routineId: _r, position: _p, exercise: _e, ...rest }) => rest,
        ),
      ),
    );
    const byRoutine = loadExercises(db, [copy.id]);
    res
      .status(201)
      .json({ routine: { ...copy, exercises: byRoutine.get(copy.id) ?? [] } });
  });

  router.delete("/:id", (req, res) => {
    const routine = ownedRoutine(req, Number(req.params.id));
    // Hard delete; sessions logged from it keep their own copy (Phase 5).
    db.delete(routines).where(eq(routines.id, routine.id)).run();
    res.json({ ok: true });
  });

  return router;
}
