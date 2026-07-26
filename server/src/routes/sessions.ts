import { Router } from "express";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import {
  exercises,
  routines,
  routineExercises,
  sessionExercises,
  sets,
  workoutSessions,
  type WorkoutSession,
  type WorkoutSet,
} from "../db/schema.js";
import { ApiError, parseBody } from "../lib/errors.js";

const startSchema = z.object({
  routineId: z.number().int().positive().optional(),
});

const patchSessionSchema = z.object({
  notes: z.string().max(2000).nullish(),
  finished: z.boolean().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().nullish(),
});

const setPatchSchema = z.object({
  weight: z.number().min(0).max(5000).nullish(),
  reps: z.number().int().min(0).max(10000).nullish(),
  durationSec: z.number().int().min(0).max(86400).nullish(),
  distance: z.number().min(0).max(1000).nullish(),
  isWarmup: z.boolean().optional(),
  completed: z.boolean().optional(),
});

type SetSeed = Partial<WorkoutSet>;

export function sessionRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  function ownedSession(userId: number, id: number): WorkoutSession {
    const session = db
      .select()
      .from(workoutSessions)
      .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
      .get();
    if (!session) throw new ApiError(404, "NOT_FOUND", "No such session");
    return session;
  }

  function ownedSessionExercise(userId: number, sessionId: number, seId: number) {
    ownedSession(userId, sessionId);
    const se = db
      .select()
      .from(sessionExercises)
      .where(
        and(eq(sessionExercises.id, seId), eq(sessionExercises.sessionId, sessionId)),
      )
      .get();
    if (!se) throw new ApiError(404, "NOT_FOUND", "No such session exercise");
    return se;
  }

  // Most recent finished session's sets for each exercise id — powers the
  // "last time" hints next to inputs.
  function previousSets(
    userId: number,
    exerciseIds: number[],
    excludeSessionId: number,
  ): Record<number, WorkoutSet[]> {
    const result: Record<number, WorkoutSet[]> = {};
    for (const exerciseId of exerciseIds) {
      const lastSe = db
        .select({ id: sessionExercises.id })
        .from(sessionExercises)
        .innerJoin(
          workoutSessions,
          eq(sessionExercises.sessionId, workoutSessions.id),
        )
        .where(
          and(
            eq(workoutSessions.userId, userId),
            isNotNull(workoutSessions.finishedAt),
            eq(sessionExercises.exerciseId, exerciseId),
            ne(workoutSessions.id, excludeSessionId),
          ),
        )
        .orderBy(desc(workoutSessions.startedAt))
        .limit(1)
        .get();
      if (lastSe) {
        result[exerciseId] = db
          .select()
          .from(sets)
          .where(and(eq(sets.sessionExerciseId, lastSe.id), eq(sets.completed, true)))
          .orderBy(asc(sets.position))
          .all();
      }
    }
    return result;
  }

  function fullSession(userId: number, id: number) {
    const session = ownedSession(userId, id);
    const seRows = db
      .select({
        se: sessionExercises,
        exercise: {
          id: exercises.id,
          name: exercises.name,
          logType: exercises.logType,
          images: exercises.images,
        },
      })
      .from(sessionExercises)
      .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
      .where(eq(sessionExercises.sessionId, id))
      .orderBy(asc(sessionExercises.position))
      .all();
    const seIds = seRows.map((r) => r.se.id);
    const allSets =
      seIds.length > 0
        ? db
            .select()
            .from(sets)
            .where(inArray(sets.sessionExerciseId, seIds))
            .orderBy(asc(sets.position))
            .all()
        : [];
    const previous = previousSets(
      userId,
      seRows.map((r) => r.se.exerciseId),
      id,
    );
    return {
      ...session,
      exercises: seRows.map((r) => ({
        ...r.se,
        exercise: r.exercise,
        sets: allSets.filter((s) => s.sessionExerciseId === r.se.id),
        previous: previous[r.se.exerciseId] ?? [],
      })),
    };
  }

  router.get("/active", (req, res) => {
    const active = db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, req.user!.id),
          isNull(workoutSessions.finishedAt),
        ),
      )
      .orderBy(desc(workoutSessions.startedAt))
      .get();
    res.json({ session: active ? fullSession(req.user!.id, active.id) : null });
  });

  router.get("/", (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = 20;
    const history = db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, req.user!.id),
          isNotNull(workoutSessions.finishedAt),
        ),
      )
      .orderBy(desc(workoutSessions.startedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    const summaries = history.map((s) => {
      const seRows = db
        .select({ id: sessionExercises.id })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, s.id))
        .all();
      const seIds = seRows.map((r) => r.id);
      const completed =
        seIds.length > 0
          ? db
              .select()
              .from(sets)
              .where(and(inArray(sets.sessionExerciseId, seIds), eq(sets.completed, true)))
              .all()
          : [];
      const volume = completed.reduce(
        (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
        0,
      );
      return {
        ...s,
        exerciseCount: seIds.length,
        setCount: completed.length,
        volume,
      };
    });
    res.json({ sessions: summaries, page });
  });

  router.get("/:id", (req, res) => {
    res.json({ session: fullSession(req.user!.id, Number(req.params.id)) });
  });

  // Start a session — freeform, or prefilled from a routine.
  router.post("/", (req, res) => {
    const input = parseBody(startSchema, req.body);
    const existing = db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, req.user!.id),
          isNull(workoutSessions.finishedAt),
        ),
      )
      .get();
    if (existing) {
      throw new ApiError(409, "ACTIVE_SESSION", "A workout is already in progress");
    }

    let routineName: string | null = null;
    let seed: { exerciseId: number; sets: SetSeed[]; }[] = [];
    if (input.routineId != null) {
      const routine = db
        .select()
        .from(routines)
        .where(
          and(eq(routines.id, input.routineId), eq(routines.userId, req.user!.id)),
        )
        .get();
      if (!routine) throw new ApiError(400, "VALIDATION", "Unknown routine");
      routineName = routine.name;
      const items = db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routine.id))
        .orderBy(asc(routineExercises.position))
        .all();
      seed = items.map((item) => ({
        exerciseId: item.exerciseId,
        sets: Array.from({ length: item.targetSets ?? 1 }, () => ({
          weight: item.targetWeight,
          reps: item.targetReps,
          durationSec: item.targetDurationSec,
          distance: item.targetDistance,
        })),
      }));
    }

    const session = db.transaction((tx) => {
      const created = tx
        .insert(workoutSessions)
        .values({
          userId: req.user!.id,
          routineId: input.routineId ?? null,
          routineName,
          startedAt: new Date(),
        })
        .returning()
        .get();
      seed.forEach((item, position) => {
        const se = tx
          .insert(sessionExercises)
          .values({ sessionId: created.id, exerciseId: item.exerciseId, position })
          .returning()
          .get();
        item.sets.forEach((s, setPos) => {
          tx.insert(sets)
            .values({
              sessionExerciseId: se.id,
              position: setPos,
              weight: s.weight ?? null,
              reps: s.reps ?? null,
              durationSec: s.durationSec ?? null,
              distance: s.distance ?? null,
            })
            .run();
        });
      });
      return created;
    });
    res.status(201).json({ session: fullSession(req.user!.id, session.id) });
  });

  router.patch("/:id", (req, res) => {
    const session = ownedSession(req.user!.id, Number(req.params.id));
    const input = parseBody(patchSessionSchema, req.body);
    db.update(workoutSessions)
      .set({
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.finished === true && session.finishedAt == null
          ? { finishedAt: new Date() }
          : {}),
        ...(input.startedAt !== undefined
          ? { startedAt: new Date(input.startedAt) }
          : {}),
        ...(input.finishedAt !== undefined
          ? { finishedAt: input.finishedAt == null ? null : new Date(input.finishedAt) }
          : {}),
      })
      .where(eq(workoutSessions.id, session.id))
      .run();
    res.json({ session: fullSession(req.user!.id, session.id) });
  });

  router.delete("/:id", (req, res) => {
    const session = ownedSession(req.user!.id, Number(req.params.id));
    db.delete(workoutSessions).where(eq(workoutSessions.id, session.id)).run();
    res.json({ ok: true });
  });

  router.post("/:id/exercises", (req, res) => {
    const session = ownedSession(req.user!.id, Number(req.params.id));
    const input = parseBody(
      z.object({ exerciseId: z.number().int().positive() }),
      req.body,
    );
    const visible = db
      .select()
      .from(exercises)
      .where(
        and(
          eq(exercises.id, input.exerciseId),
          or(isNull(exercises.ownerId), eq(exercises.ownerId, req.user!.id)),
          eq(exercises.isDeleted, false),
        ),
      )
      .get();
    if (!visible) throw new ApiError(400, "VALIDATION", "Unknown exercise");
    const position =
      db
        .select({ id: sessionExercises.id })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, session.id))
        .all().length;
    const se = db
      .insert(sessionExercises)
      .values({ sessionId: session.id, exerciseId: input.exerciseId, position })
      .returning()
      .get();
    // Start with one empty set so there's something to fill in.
    db.insert(sets).values({ sessionExerciseId: se.id, position: 0 }).run();
    res.status(201).json({ session: fullSession(req.user!.id, session.id) });
  });

  router.delete("/:id/exercises/:seId", (req, res) => {
    const se = ownedSessionExercise(
      req.user!.id,
      Number(req.params.id),
      Number(req.params.seId),
    );
    db.delete(sessionExercises).where(eq(sessionExercises.id, se.id)).run();
    res.json({ session: fullSession(req.user!.id, Number(req.params.id)) });
  });

  router.post("/:id/exercises/:seId/sets", (req, res) => {
    const se = ownedSessionExercise(
      req.user!.id,
      Number(req.params.id),
      Number(req.params.seId),
    );
    const existing = db
      .select()
      .from(sets)
      .where(eq(sets.sessionExerciseId, se.id))
      .orderBy(desc(sets.position))
      .all();
    const last = existing[0];
    const set = db
      .insert(sets)
      .values({
        sessionExerciseId: se.id,
        position: (last?.position ?? -1) + 1,
        // Carry forward the previous set's numbers as a starting point.
        weight: last?.weight ?? null,
        reps: last?.reps ?? null,
        durationSec: last?.durationSec ?? null,
        distance: last?.distance ?? null,
      })
      .returning()
      .get();
    res.status(201).json({ set });
  });

  router.patch("/:id/exercises/:seId/sets/:setId", (req, res) => {
    const se = ownedSessionExercise(
      req.user!.id,
      Number(req.params.id),
      Number(req.params.seId),
    );
    const set = db
      .select()
      .from(sets)
      .where(and(eq(sets.id, Number(req.params.setId)), eq(sets.sessionExerciseId, se.id)))
      .get();
    if (!set) throw new ApiError(404, "NOT_FOUND", "No such set");
    const patch = parseBody(setPatchSchema, req.body);
    const updated = db
      .update(sets)
      .set(patch)
      .where(eq(sets.id, set.id))
      .returning()
      .get();
    res.json({ set: updated });
  });

  router.delete("/:id/exercises/:seId/sets/:setId", (req, res) => {
    const se = ownedSessionExercise(
      req.user!.id,
      Number(req.params.id),
      Number(req.params.seId),
    );
    const set = db
      .select()
      .from(sets)
      .where(and(eq(sets.id, Number(req.params.setId)), eq(sets.sessionExerciseId, se.id)))
      .get();
    if (!set) throw new ApiError(404, "NOT_FOUND", "No such set");
    db.delete(sets).where(eq(sets.id, set.id)).run();
    res.json({ ok: true });
  });

  return router;
}
