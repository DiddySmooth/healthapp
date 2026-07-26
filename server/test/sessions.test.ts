import { describe, expect, it } from "vitest";
import { seedExercises } from "../src/db/seed.js";
import { epley1RM } from "../src/lib/stats.js";
import { createAndLoginUser, setupAdmin, testApp, testDb, type AuthedAgent } from "./helpers.js";

function seededApp() {
  const db = testDb();
  seedExercises(db);
  return testApp(db);
}

async function makeRoutine(agent: AuthedAgent): Promise<{ routineId: number; exerciseIds: number[] }> {
  const list = await agent.get("/api/exercises?logType=strength&pageSize=2").expect(200);
  const ids = list.body.exercises.map((e: { id: number }) => e.id);
  const routine = await agent
    .post("/api/routines")
    .send({
      name: "Test Day",
      exercises: [
        { exerciseId: ids[0], targetSets: 3, targetReps: 8, targetWeight: 100 },
        { exerciseId: ids[1], targetSets: 2, targetReps: 12 },
      ],
    })
    .expect(201);
  return { routineId: routine.body.routine.id, exerciseIds: ids };
}

async function completeAllSets(agent: AuthedAgent, session: {
  id: number;
  exercises: { id: number; sets: { id: number }[] }[];
}) {
  for (const se of session.exercises) {
    for (const set of se.sets) {
      await agent
        .patch(`/api/sessions/${session.id}/exercises/${se.id}/sets/${set.id}`)
        .send({ completed: true })
        .expect(200);
    }
  }
}

describe("session lifecycle", () => {
  it("starts from a routine with prefilled exercises and target sets", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId } = await makeRoutine(admin);

    const started = await admin.post("/api/sessions").send({ routineId }).expect(201);
    const session = started.body.session;
    expect(session.routineName).toBe("Test Day");
    expect(session.finishedAt).toBeNull();
    expect(session.exercises).toHaveLength(2);
    expect(session.exercises[0].sets).toHaveLength(3);
    expect(session.exercises[0].sets[0].weight).toBe(100);
    expect(session.exercises[0].sets[0].reps).toBe(8);
    expect(session.exercises[0].sets[0].completed).toBe(false);
    expect(session.exercises[1].sets).toHaveLength(2);
  });

  it("refuses a second concurrent session and exposes the active one", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId } = await makeRoutine(admin);
    await admin.post("/api/sessions").send({ routineId }).expect(201);

    await admin.post("/api/sessions").send({}).expect(409);
    const active = await admin.get("/api/sessions/active").expect(200);
    expect(active.body.session).not.toBeNull();
    expect(active.body.session.routineName).toBe("Test Day");
  });

  it("logs sets, finishes, and shows up in history with volume", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId } = await makeRoutine(admin);
    const session = (await admin.post("/api/sessions").send({ routineId })).body.session;

    await completeAllSets(admin, session);
    await admin.patch(`/api/sessions/${session.id}`).send({ finished: true }).expect(200);

    const active = await admin.get("/api/sessions/active").expect(200);
    expect(active.body.session).toBeNull();

    const history = await admin.get("/api/sessions").expect(200);
    expect(history.body.sessions).toHaveLength(1);
    const summary = history.body.sessions[0];
    expect(summary.exerciseCount).toBe(2);
    expect(summary.setCount).toBe(5);
    // 3 sets × 100 × 8 reps; second exercise has no weight.
    expect(summary.volume).toBe(2400);
  });

  it("supports freeform sessions: add exercise, add/edit/delete sets", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const list = await admin.get("/api/exercises?logType=cardio&pageSize=1").expect(200);
    const exerciseId = list.body.exercises[0].id;

    const session = (await admin.post("/api/sessions").send({})).body.session;
    expect(session.exercises).toHaveLength(0);

    const withEx = await admin
      .post(`/api/sessions/${session.id}/exercises`)
      .send({ exerciseId })
      .expect(201);
    const se = withEx.body.session.exercises[0];
    expect(se.sets).toHaveLength(1);

    await admin
      .patch(`/api/sessions/${session.id}/exercises/${se.id}/sets/${se.sets[0].id}`)
      .send({ durationSec: 1200, distance: 2.5, completed: true })
      .expect(200);

    const added = await admin
      .post(`/api/sessions/${session.id}/exercises/${se.id}/sets`)
      .expect(201);
    // New set carries forward the previous set's numbers.
    expect(added.body.set.durationSec).toBe(1200);

    await admin
      .delete(`/api/sessions/${session.id}/exercises/${se.id}/sets/${added.body.set.id}`)
      .expect(200);
    const detail = await admin.get(`/api/sessions/${session.id}`).expect(200);
    expect(detail.body.session.exercises[0].sets).toHaveLength(1);
  });

  it("shows previous session numbers for the same exercise", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId } = await makeRoutine(admin);

    const first = (await admin.post("/api/sessions").send({ routineId })).body.session;
    await completeAllSets(admin, first);
    await admin.patch(`/api/sessions/${first.id}`).send({ finished: true }).expect(200);

    const second = (await admin.post("/api/sessions").send({ routineId })).body.session;
    expect(second.exercises[0].previous).toHaveLength(3);
    expect(second.exercises[0].previous[0].weight).toBe(100);
  });

  it("keeps sessions private between users", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const { routineId } = await makeRoutine(admin);
    const session = (await admin.post("/api/sessions").send({ routineId })).body.session;

    await bob.get(`/api/sessions/${session.id}`).expect(404);
    await bob.patch(`/api/sessions/${session.id}`).send({ finished: true }).expect(404);
    await bob.delete(`/api/sessions/${session.id}`).expect(404);
    const bobHistory = await bob.get("/api/sessions").expect(200);
    expect(bobHistory.body.sessions).toHaveLength(0);
  });

  it("can edit a past session's sets and notes", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId } = await makeRoutine(admin);
    const session = (await admin.post("/api/sessions").send({ routineId })).body.session;
    await completeAllSets(admin, session);
    await admin.patch(`/api/sessions/${session.id}`).send({ finished: true });

    const se = session.exercises[0];
    await admin
      .patch(`/api/sessions/${session.id}/exercises/${se.id}/sets/${se.sets[0].id}`)
      .send({ weight: 105 })
      .expect(200);
    await admin
      .patch(`/api/sessions/${session.id}`)
      .send({ notes: "Felt strong" })
      .expect(200);

    const detail = await admin.get(`/api/sessions/${session.id}`).expect(200);
    expect(detail.body.session.notes).toBe("Felt strong");
    expect(detail.body.session.exercises[0].sets[0].weight).toBe(105);
  });
});

describe("stats", () => {
  it("computes Epley 1RM with known fixtures", () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 5)).toBe(116.7);
    expect(epley1RM(225, 3)).toBe(247.5);
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
  });

  it("tracks PRs and history for an exercise", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId, exerciseIds } = await makeRoutine(admin);

    const s1 = (await admin.post("/api/sessions").send({ routineId })).body.session;
    // Bump one set heavier than the target.
    const se = s1.exercises[0];
    await admin
      .patch(`/api/sessions/${s1.id}/exercises/${se.id}/sets/${se.sets[0].id}`)
      .send({ weight: 120, reps: 5, completed: true })
      .expect(200);
    await admin
      .patch(`/api/sessions/${s1.id}/exercises/${se.id}/sets/${se.sets[1].id}`)
      .send({ completed: true })
      .expect(200);
    await admin.patch(`/api/sessions/${s1.id}`).send({ finished: true });

    const stats = await admin.get(`/api/stats/exercise/${exerciseIds[0]}`).expect(200);
    expect(stats.body.prs.maxWeight.weight).toBe(120);
    expect(stats.body.prs.best1RM.value).toBe(140);
    expect(stats.body.history).toHaveLength(1);
    expect(stats.body.history[0].sets).toHaveLength(2);
  });

  it("warmup sets don't count toward PRs", async () => {
    const { app } = seededApp();
    const admin = await setupAdmin(app);
    const { routineId, exerciseIds } = await makeRoutine(admin);
    const s = (await admin.post("/api/sessions").send({ routineId })).body.session;
    const se = s.exercises[0];
    await admin
      .patch(`/api/sessions/${s.id}/exercises/${se.id}/sets/${se.sets[0].id}`)
      .send({ weight: 500, reps: 1, completed: true, isWarmup: true })
      .expect(200);
    await admin
      .patch(`/api/sessions/${s.id}/exercises/${se.id}/sets/${se.sets[1].id}`)
      .send({ weight: 100, reps: 5, completed: true })
      .expect(200);
    await admin.patch(`/api/sessions/${s.id}`).send({ finished: true });

    const stats = await admin.get(`/api/stats/exercise/${exerciseIds[0]}`).expect(200);
    expect(stats.body.prs.maxWeight.weight).toBe(100);
  });
});
