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
};

export const defaultUserSettings: UserSettings = {
  weightUnit: "lbs",
  distanceUnit: "mi",
  timezone: "UTC",
  weekStart: "monday",
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
