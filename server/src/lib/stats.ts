import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { exercises, sessionExercises, sets, workoutSessions } from "../db/schema.js";
import type { WorkoutSet } from "../db/schema.js";

// Epley estimated one-rep max; by convention the raw weight for a single.
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export type ExercisePRs = {
  maxWeight: { weight: number; reps: number; date: Date } | null;
  best1RM: { value: number; weight: number; reps: number; date: Date } | null;
  maxReps: { reps: number; weight: number | null; date: Date } | null;
  maxDurationSec: { durationSec: number; date: Date } | null;
  maxDistance: { distance: number; date: Date } | null;
};

export type ExerciseHistoryEntry = {
  sessionId: number;
  date: Date;
  sets: WorkoutSet[];
};

// Completed, non-warmup sets for one exercise across finished sessions.
function completedSets(db: Db, userId: number, exerciseId: number) {
  return db
    .select({ set: sets, sessionId: workoutSessions.id, date: workoutSessions.startedAt })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.finishedAt),
        eq(sessionExercises.exerciseId, exerciseId),
        eq(sets.completed, true),
        eq(sets.isWarmup, false),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt), asc(sets.position))
    .all();
}

export function exerciseHistory(
  db: Db,
  userId: number,
  exerciseId: number,
  limit = 20,
): ExerciseHistoryEntry[] {
  const rows = completedSets(db, userId, exerciseId);
  const bySession = new Map<number, ExerciseHistoryEntry>();
  for (const row of rows) {
    const entry = bySession.get(row.sessionId) ?? {
      sessionId: row.sessionId,
      date: row.date,
      sets: [],
    };
    entry.sets.push(row.set);
    bySession.set(row.sessionId, entry);
  }
  return [...bySession.values()].slice(0, limit);
}

export function exercisePRs(db: Db, userId: number, exerciseId: number): ExercisePRs {
  const rows = completedSets(db, userId, exerciseId);
  const prs: ExercisePRs = {
    maxWeight: null,
    best1RM: null,
    maxReps: null,
    maxDurationSec: null,
    maxDistance: null,
  };
  for (const { set, date } of rows) {
    if (set.weight != null && set.weight > 0) {
      if (!prs.maxWeight || set.weight > prs.maxWeight.weight) {
        prs.maxWeight = { weight: set.weight, reps: set.reps ?? 0, date };
      }
      const oneRm = epley1RM(set.weight, set.reps ?? 0);
      if (oneRm > 0 && (!prs.best1RM || oneRm > prs.best1RM.value)) {
        prs.best1RM = { value: oneRm, weight: set.weight, reps: set.reps ?? 0, date };
      }
    }
    if (set.reps != null && set.reps > 0) {
      if (!prs.maxReps || set.reps > prs.maxReps.reps) {
        prs.maxReps = { reps: set.reps, weight: set.weight, date };
      }
    }
    if (set.durationSec != null && set.durationSec > 0) {
      if (!prs.maxDurationSec || set.durationSec > prs.maxDurationSec.durationSec) {
        prs.maxDurationSec = { durationSec: set.durationSec, date };
      }
    }
    if (set.distance != null && set.distance > 0) {
      if (!prs.maxDistance || set.distance > prs.maxDistance.distance) {
        prs.maxDistance = { distance: set.distance, date };
      }
    }
  }
  return prs;
}

// Total completed working volume (weight × reps) per primary muscle group,
// for finished sessions started in [from, to).
export function volumeByMuscle(
  db: Db,
  userId: number,
  from: Date,
  to: Date,
): Record<string, number> {
  const rows = db
    .select({
      set: sets,
      startedAt: workoutSessions.startedAt,
      muscles: exercises.primaryMuscles,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .innerJoin(workoutSessions, eq(sessionExercises.sessionId, workoutSessions.id))
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.finishedAt),
        eq(sets.completed, true),
        eq(sets.isWarmup, false),
      ),
    )
    .all();
  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.startedAt < from || row.startedAt >= to) continue;
    const volume = (row.set.weight ?? 0) * (row.set.reps ?? 0);
    if (volume <= 0) continue;
    for (const muscle of row.muscles) {
      result[muscle] = (result[muscle] ?? 0) + volume;
    }
  }
  return result;
}
