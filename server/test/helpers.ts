import { migrateDb, openDb, type Db } from "../src/db/index.js";

// Fresh in-memory database with all migrations applied.
export function testDb(): Db {
  const db = openDb(":memory:");
  migrateDb(db);
  return db;
}
