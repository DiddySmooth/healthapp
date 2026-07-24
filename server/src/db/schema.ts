import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// Instance-level key/value metadata (instance id, schema info, setup state).
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
