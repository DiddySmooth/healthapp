import { describe, expect, it } from "vitest";
import { seedExercises } from "../src/db/seed.js";
import { createAndLoginUser, setupAdmin, testApp, testDb, type AuthedAgent } from "./helpers.js";

function seededApp() {
  const db = testDb();
  seedExercises(db);
  return testApp(db);
}

async function someExerciseIds(agent: AuthedAgent, n: number): Promise<number[]> {
  const res = await agent.get(`/api/exercises?pageSize=${n}`).expect(200);
  return res.body.exercises.map((e: { id: number }) => e.id);
}

describe("routines", () => {
  it("creates a routine with ordered exercises and reads it back", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const [a, b, c] = await someExerciseIds(admin, 3);

    const created = await admin
      .post("/api/routines")
      .send({
        name: "Push Day A",
        description: "Chest focus",
        exercises: [
          { exerciseId: a, targetSets: 4, targetReps: 8, targetWeight: 135 },
          { exerciseId: b, targetSets: 3, targetReps: 12 },
          { exerciseId: c, targetDurationSec: 300 },
        ],
      })
      .expect(201);

    const routine = created.body.routine;
    expect(routine.exercises).toHaveLength(3);
    expect(routine.exercises.map((e: { position: number }) => e.position)).toEqual([
      0, 1, 2,
    ]);
    expect(routine.exercises[0].exerciseId).toBe(a);

    const list = await admin.get("/api/routines").expect(200);
    expect(list.body.routines).toHaveLength(1);
  });

  it("replaces and reorders exercises on update", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const [a, b] = await someExerciseIds(admin, 2);

    const created = await admin
      .post("/api/routines")
      .send({ name: "R", exercises: [{ exerciseId: a }, { exerciseId: b }] })
      .expect(201);
    const id = created.body.routine.id;

    const updated = await admin
      .put(`/api/routines/${id}`)
      .send({ name: "R2", exercises: [{ exerciseId: b, targetSets: 5 }] })
      .expect(200);
    expect(updated.body.routine.name).toBe("R2");
    expect(updated.body.routine.exercises).toHaveLength(1);
    expect(updated.body.routine.exercises[0].exerciseId).toBe(b);
    expect(updated.body.routine.exercises[0].targetSets).toBe(5);
  });

  it("duplicates a routine with its exercises", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const [a, b] = await someExerciseIds(admin, 2);
    const created = await admin
      .post("/api/routines")
      .send({
        name: "Legs",
        exercises: [{ exerciseId: a, targetSets: 3 }, { exerciseId: b }],
      })
      .expect(201);

    const dup = await admin
      .post(`/api/routines/${created.body.routine.id}/duplicate`)
      .expect(201);
    expect(dup.body.routine.name).toBe("Legs (copy)");
    expect(dup.body.routine.exercises).toHaveLength(2);
    expect(dup.body.routine.id).not.toBe(created.body.routine.id);
  });

  it("rejects exercises the user cannot see", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const bobCustom = await bob
      .post("/api/exercises")
      .send({ name: "Bob Secret Move", logType: "strength" })
      .expect(201);

    await admin
      .post("/api/routines")
      .send({ name: "Steal", exercises: [{ exerciseId: bobCustom.body.exercise.id }] })
      .expect(400);
  });

  it("keeps routines private between users", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const [a] = await someExerciseIds(admin, 1);
    const created = await admin
      .post("/api/routines")
      .send({ name: "Mine", exercises: [{ exerciseId: a }] })
      .expect(201);
    const id = created.body.routine.id;

    const bobList = await bob.get("/api/routines").expect(200);
    expect(bobList.body.routines).toHaveLength(0);
    await bob.get(`/api/routines/${id}`).expect(404);
    await bob.put(`/api/routines/${id}`).send({ name: "x", exercises: [] }).expect(404);
    await bob.delete(`/api/routines/${id}`).expect(404);
  });
});

describe("schedule", () => {
  it("creates weekday and date entries and lists them", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const [a] = await someExerciseIds(admin, 1);
    const routine = (
      await admin
        .post("/api/routines")
        .send({ name: "Push", exercises: [{ exerciseId: a }] })
        .expect(201)
    ).body.routine;

    await admin
      .post("/api/schedule")
      .send({ routineId: routine.id, weekday: 1 })
      .expect(201);
    await admin
      .post("/api/schedule")
      .send({ routineId: routine.id, date: "2026-08-03" })
      .expect(201);

    const list = await admin.get("/api/schedule").expect(200);
    expect(list.body.entries).toHaveLength(2);
  });

  it("rejects entries with both or neither of weekday/date", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const [a] = await someExerciseIds(admin, 1);
    const routine = (
      await admin
        .post("/api/routines")
        .send({ name: "R", exercises: [{ exerciseId: a }] })
        .expect(201)
    ).body.routine;

    await admin.post("/api/schedule").send({ routineId: routine.id }).expect(400);
    await admin
      .post("/api/schedule")
      .send({ routineId: routine.id, weekday: 1, date: "2026-08-03" })
      .expect(400);
  });

  it("cannot schedule another user's routine or delete their entries", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const [a] = await someExerciseIds(admin, 1);
    const routine = (
      await admin
        .post("/api/routines")
        .send({ name: "Mine", exercises: [{ exerciseId: a }] })
        .expect(201)
    ).body.routine;

    await bob
      .post("/api/schedule")
      .send({ routineId: routine.id, weekday: 2 })
      .expect(400);

    const entry = (
      await admin.post("/api/schedule").send({ routineId: routine.id, weekday: 3 })
    ).body.entry;
    await bob.delete(`/api/schedule/${entry.id}`).expect(404);
  });

  it("deleting a routine removes its schedule entries", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const [a] = await someExerciseIds(admin, 1);
    const routine = (
      await admin
        .post("/api/routines")
        .send({ name: "R", exercises: [{ exerciseId: a }] })
        .expect(201)
    ).body.routine;
    await admin.post("/api/schedule").send({ routineId: routine.id, weekday: 5 });

    await admin.delete(`/api/routines/${routine.id}`).expect(200);
    const list = await admin.get("/api/schedule").expect(200);
    expect(list.body.entries).toHaveLength(0);
  });
});
