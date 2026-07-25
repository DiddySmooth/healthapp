import { describe, expect, it } from "vitest";
import { seedExercises } from "../src/db/seed.js";
import { createAndLoginUser, setupAdmin, testApp, testDb } from "./helpers.js";

function seededApp() {
  const db = testDb();
  seedExercises(db);
  return testApp(db);
}

describe("exercise seeding", () => {
  it("seeds the bundled dataset once, idempotently", () => {
    const db = testDb();
    const first = seedExercises(db);
    expect(first).toBeGreaterThan(800);
    const second = seedExercises(db);
    expect(second).toBe(0);
  });
});

describe("exercise library", () => {
  it("lists with pagination and total", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const res = await admin.get("/api/exercises?page=1&pageSize=10").expect(200);
    expect(res.body.exercises).toHaveLength(10);
    expect(res.body.total).toBeGreaterThan(800);
  });

  it("filters by search, muscle, equipment, and logType", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);

    const search = await admin.get("/api/exercises?search=bench+press").expect(200);
    expect(search.body.total).toBeGreaterThan(0);
    for (const e of search.body.exercises) {
      expect(e.name.toLowerCase()).toContain("bench press");
    }

    const chest = await admin.get("/api/exercises?muscle=chest&pageSize=100").expect(200);
    expect(chest.body.total).toBeGreaterThan(0);
    for (const e of chest.body.exercises) {
      expect([...e.primaryMuscles, ...e.secondaryMuscles]).toContain("chest");
    }

    const barbell = await admin.get("/api/exercises?equipment=barbell").expect(200);
    for (const e of barbell.body.exercises) {
      expect(e.equipment).toBe("barbell");
    }

    const cardio = await admin.get("/api/exercises?logType=cardio").expect(200);
    for (const e of cardio.body.exercises) {
      expect(e.logType).toBe("cardio");
    }
  });

  it("serves filter metadata", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const res = await admin.get("/api/exercises/meta").expect(200);
    expect(res.body.muscles).toContain("chest");
    expect(res.body.equipment).toContain("barbell");
  });

  it("requires auth", async () => {
    const { app } = seededApp();
    await setupAdmin(app); // instance is set up but this request is anonymous
    const request = (await import("supertest")).default;
    await request(app).get("/api/exercises").expect(401);
  });
});

describe("custom exercises", () => {
  it("creates, lists, edits, and soft-deletes a custom exercise", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);

    const created = await admin
      .post("/api/exercises")
      .send({ name: "Zylophone Carry", logType: "cardio", equipment: "sled" })
      .expect(201);
    const id = created.body.exercise.id;

    const found = await admin.get("/api/exercises?search=Zylophone").expect(200);
    expect(found.body.total).toBe(1);

    await admin.patch(`/api/exercises/${id}`).send({ name: "Zylophone Drag" }).expect(200);
    await admin.delete(`/api/exercises/${id}`).expect(200);

    const gone = await admin.get("/api/exercises?search=Zylophone").expect(200);
    expect(gone.body.exercises.map((e: { id: number }) => e.id)).not.toContain(id);
  });

  it("keeps custom exercises private between users", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");

    const created = await bob
      .post("/api/exercises")
      .send({ name: "Bob Special", logType: "strength" })
      .expect(201);
    const id = created.body.exercise.id;

    // Admin can't see, fetch, edit, or delete Bob's exercise.
    const adminSearch = await admin.get("/api/exercises?search=Bob+Special").expect(200);
    expect(adminSearch.body.total).toBe(0);
    await admin.get(`/api/exercises/${id}`).expect(404);
    await admin.patch(`/api/exercises/${id}`).send({ name: "hijack" }).expect(404);
    await admin.delete(`/api/exercises/${id}`).expect(404);
  });

  it("cannot edit or delete bundled exercises", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const list = await admin.get("/api/exercises?pageSize=1").expect(200);
    const bundledId = list.body.exercises[0].id;
    await admin.patch(`/api/exercises/${bundledId}`).send({ name: "nope" }).expect(404);
    await admin.delete(`/api/exercises/${bundledId}`).expect(404);
  });
});
