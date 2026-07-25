import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

// In dev this resolves to server/drizzle; the Docker image sets
// MIGRATIONS_DIR explicitly because bundling changes import.meta.dirname.
const migrationsFolder =
  process.env.MIGRATIONS_DIR ??
  path.join(import.meta.dirname, "..", "..", "drizzle");

export function openDb(file: string): Db {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder });
}
