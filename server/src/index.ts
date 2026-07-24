import { buildApp } from "./app.js";
import { config, dbPath } from "./config.js";
import { migrateDb, openDb } from "./db/index.js";

const db = openDb(dbPath());
migrateDb(db);

const app = buildApp(db);
app.listen(config.port, () => {
  console.log(`HealthApp listening on port ${config.port}`);
});
