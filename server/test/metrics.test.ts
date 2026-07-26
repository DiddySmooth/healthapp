import { describe, expect, it } from "vitest";
import { createAndLoginUser, setupAdmin, testApp } from "./helpers.js";

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("sv");
}

describe("body metrics", () => {
  it("logs, lists (newest first), filters by type, and deletes", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);

    await admin
      .post("/api/metrics")
      .send({ date: "2026-07-20", type: "weight", value: 185 })
      .expect(201);
    await admin
      .post("/api/metrics")
      .send({ date: "2026-07-25", type: "weight", value: 183.5 })
      .expect(201);
    const waist = (
      await admin
        .post("/api/metrics")
        .send({ date: "2026-07-25", type: "waist", value: 34 })
        .expect(201)
    ).body.metric;

    const weights = await admin.get("/api/metrics?type=weight").expect(200);
    expect(weights.body.metrics).toHaveLength(2);
    expect(weights.body.metrics[0].value).toBe(183.5);

    const all = await admin.get("/api/metrics").expect(200);
    expect(all.body.metrics).toHaveLength(3);

    await admin.delete(`/api/metrics/${waist.id}`).expect(200);
    const after = await admin.get("/api/metrics").expect(200);
    expect(after.body.metrics).toHaveLength(2);

    await admin.get("/api/metrics?type=nonsense").expect(400);
  });

  it("keeps metrics private between users", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const metric = (
      await admin.post("/api/metrics").send({ date: "2026-07-25", type: "weight", value: 185 })
    ).body.metric;

    const bobList = await bob.get("/api/metrics").expect(200);
    expect(bobList.body.metrics).toHaveLength(0);
    await bob.delete(`/api/metrics/${metric.id}`).expect(404);
  });
});

describe("water", () => {
  it("accumulates a day total and supports undo", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const today = todayISO();

    await admin.post("/api/water").send({ date: today, amountMl: 250 }).expect(201);
    const second = (
      await admin.post("/api/water").send({ date: today, amountMl: 500 }).expect(201)
    ).body.entry;

    let day = await admin.get(`/api/water/day/${today}`).expect(200);
    expect(day.body.totalMl).toBe(750);

    await admin.delete(`/api/water/${second.id}`).expect(200);
    day = await admin.get(`/api/water/day/${today}`).expect(200);
    expect(day.body.totalMl).toBe(250);
  });

  it("returns padded history including empty days", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    await admin.post("/api/water").send({ date: todayISO(), amountMl: 300 });
    await admin.post("/api/water").send({ date: todayISO(-2), amountMl: 700 });

    const res = await admin.get("/api/water/history?days=4").expect(200);
    expect(res.body.days).toHaveLength(4);
    expect(res.body.days[3].totalMl).toBe(300);
    expect(res.body.days[1].totalMl).toBe(700);
    expect(res.body.days[2].totalMl).toBe(0);
  });
});

describe("chart data", () => {
  it("returns padded daily calories", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const foodId = (
      await admin
        .post("/api/foods")
        .send({ name: "Oats", servingSize: 50, servingUnit: "g", calories: 190 })
        .expect(201)
    ).body.food.id;
    await admin
      .post("/api/food-log")
      .send({ foodId, date: todayISO(), meal: "breakfast", servings: 2 });

    const res = await admin.get("/api/stats/calories?days=3").expect(200);
    expect(res.body.days).toHaveLength(3);
    expect(res.body.days[2].calories).toBe(380);
    expect(res.body.days[0].calories).toBe(0);
  });

  it("returns weekly volume buckets", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const res = await admin.get("/api/stats/volume?weeks=4").expect(200);
    expect(res.body.weeks).toHaveLength(4);
    expect(res.body.weeks[3].total).toBe(0);
  });
});
