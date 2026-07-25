import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
