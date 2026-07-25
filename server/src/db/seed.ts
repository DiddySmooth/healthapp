import fs from "node:fs";
import path from "node:path";
import { count, isNull } from "drizzle-orm";
import type { Db } from "./index.js";
import { exercises, type LogType } from "./schema.js";

export const exerciseDbDir =
  process.env.EXERCISE_DB_DIR ??
  path.join(import.meta.dirname, "..", "..", "exercise-db");

type DatasetExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

function logTypeFor(e: DatasetExercise): LogType {
  if (e.category === "cardio") return "cardio";
  if (e.category === "stretching") return "duration";
  if (e.equipment === "body only") return "bodyweight";
  return "strength";
}

// Seeds the bundled exercise library once per instance (skipped if any
// bundled exercise already exists).
export function seedExercises(db: Db): number {
  const bundled =
    db.select({ n: count() }).from(exercises).where(isNull(exercises.ownerId)).get()
      ?.n ?? 0;
  if (bundled > 0) return 0;

  const file = path.join(exerciseDbDir, "exercises.json");
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as DatasetExercise[];

  db.transaction((tx) => {
    for (const e of data) {
      tx.insert(exercises)
        .values({
          externalId: e.id,
          ownerId: null,
          name: e.name,
          logType: logTypeFor(e),
          datasetCategory: e.category,
          level: e.level,
          mechanic: e.mechanic,
          force: e.force,
          equipment: e.equipment,
          primaryMuscles: e.primaryMuscles,
          secondaryMuscles: e.secondaryMuscles,
          instructions: e.instructions,
          images: e.images,
        })
        .run();
    }
  });
  return data.length;
}
