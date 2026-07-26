import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Instance-level key/value metadata (instance id, session secret, setup state).
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type UserSettings = {
  weightUnit: "lbs" | "kg";
  distanceUnit: "mi" | "km";
  timezone: string;
  weekStart: "monday" | "sunday";
  // Daily nutrition targets; null = not set.
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  waterTargetMl: number | null;
};

export const defaultUserSettings: UserSettings = {
  weightUnit: "lbs",
  distanceUnit: "mi",
  timezone: "UTC",
  weekStart: "monday",
  calorieTarget: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  waterTargetMl: null,
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  settings: text("settings", { mode: "json" })
    .$type<UserSettings>()
    .notNull()
    .$defaultFn(() => defaultUserSettings),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;

// express-session store (managed by SqliteSessionStore, not queried via Drizzle).
export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: integer("expire").notNull(),
});

// How an exercise is logged; drives which set fields the UI collects.
export type LogType = "strength" | "bodyweight" | "cardio" | "duration";

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Dataset id for bundled exercises (e.g. "3_4_Sit-Up"); null for custom.
  externalId: text("external_id").unique(),
  // null = bundled (visible to everyone); otherwise the owning user.
  ownerId: integer("owner_id").references(() => users.id),
  name: text("name").notNull(),
  logType: text("log_type", {
    enum: ["strength", "bodyweight", "cardio", "duration"],
  }).notNull(),
  datasetCategory: text("dataset_category"),
  level: text("level"),
  mechanic: text("mechanic"),
  force: text("force"),
  equipment: text("equipment"),
  primaryMuscles: text("primary_muscles", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  secondaryMuscles: text("secondary_muscles", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  instructions: text("instructions", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export type Exercise = typeof exercises.$inferSelect;

export const routines = sqliteTable("routines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const routineExercises = sqliteTable("routine_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  routineId: integer("routine_id")
    .notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  position: integer("position").notNull(),
  targetSets: integer("target_sets"),
  targetReps: integer("target_reps"),
  // Stored in the user's weight unit as entered.
  targetWeight: real("target_weight"),
  targetDurationSec: integer("target_duration_sec"),
  targetDistance: real("target_distance"),
  notes: text("notes"),
});

export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;

// A routine planned for a recurring weekday (0=Sunday..6=Saturday) or a
// specific date (YYYY-MM-DD); exactly one of the two is set.
export const schedule = sqliteTable("schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  routineId: integer("routine_id")
    .notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  weekday: integer("weekday"),
  date: text("date"),
});

export type ScheduleEntry = typeof schedule.$inferSelect;

export const workoutSessions = sqliteTable("workout_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  // Kept for provenance; null for freeform sessions or deleted routines.
  routineId: integer("routine_id"),
  routineName: text("routine_name"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  notes: text("notes"),
});

export const sessionExercises = sqliteTable("session_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  position: integer("position").notNull(),
  notes: text("notes"),
});

export const sets = sqliteTable("sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionExerciseId: integer("session_exercise_id")
    .notNull()
    .references(() => sessionExercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  weight: real("weight"),
  reps: integer("reps"),
  durationSec: integer("duration_sec"),
  distance: real("distance"),
  isWarmup: integer("is_warmup", { mode: "boolean" }).notNull().default(false),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;

// Per-serving nutrition; entered once, reused via log entries.
export const foods = sqliteTable("foods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  brand: text("brand"),
  barcode: text("barcode"),
  servingSize: real("serving_size").notNull().default(1),
  servingUnit: text("serving_unit").notNull().default("serving"),
  calories: real("calories").notNull(),
  protein: real("protein").notNull().default(0),
  carbs: real("carbs").notNull().default(0),
  fat: real("fat").notNull().default(0),
  fiber: real("fiber"),
  sugar: real("sugar"),
  sodium: real("sodium"),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Food = typeof foods.$inferSelect;

export const foodLogEntries = sqliteTable("food_log_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  foodId: integer("food_id")
    .notNull()
    .references(() => foods.id),
  // Local date the entry belongs to (YYYY-MM-DD).
  date: text("date").notNull(),
  meal: text("meal", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
  servings: real("servings").notNull().default(1),
});

export type FoodLogEntry = typeof foodLogEntries.$inferSelect;

export const metricTypes = [
  "weight",
  "waist",
  "chest",
  "hips",
  "arm",
  "thigh",
  "calf",
  "neck",
  "bodyfat",
] as const;
export type MetricType = (typeof metricTypes)[number];

export const bodyMetrics = sqliteTable("body_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(),
  type: text("type", { enum: metricTypes }).notNull(),
  // Weight in the user's unit; measurements in in/cm; bodyfat in %.
  value: real("value").notNull(),
});

export type BodyMetric = typeof bodyMetrics.$inferSelect;

export const waterLog = sqliteTable("water_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(),
  amountMl: integer("amount_ml").notNull(),
});

export type WaterEntry = typeof waterLog.$inferSelect;
