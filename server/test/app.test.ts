import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { migrateDb } from "../src/db/index.js";
import { appMeta } from "../src/db/schema.js";
import { testDb } from "./helpers.js";

describe("migrations", () => {
  it("apply cleanly and produce a usable schema", () => {
    const db = testDb();
    db.insert(appMeta).values({ key: "instance", value: "test" }).run();
    const rows = db.select().from(appMeta).all();
    expect(rows).toEqual([{ key: "instance", value: "test" }]);
  });

  it("are idempotent when re-run", () => {
    const db = testDb();
    expect(() => migrateDb(db)).not.toThrow();
  });
});

describe("app", () => {
  it("GET /healthz returns ok", async () => {
    const app = buildApp(testDb(), "/nonexistent-client-dist");
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("unknown API routes return a consistent error envelope", async () => {
    const app = buildApp(testDb(), "/nonexistent-client-dist");
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
