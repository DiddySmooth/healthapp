import { buildApp } from "./app.js";
import { config, dbPath } from "./config.js";
import { migrateDb, openDb } from "./db/index.js";
import { seedExercises } from "./db/seed.js";

const db = openDb(dbPath());
migrateDb(db);
const seeded = seedExercises(db);
if (seeded > 0) console.log(`Seeded ${seeded} bundled exercises`);

const app = buildApp(db);
app.listen(config.port, () => {
  console.log(`HealthApp listening on port ${config.port}`);
});
