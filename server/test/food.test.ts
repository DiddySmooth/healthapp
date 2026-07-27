import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { FetchLike } from "../src/routes/lookup.js";
import { createAndLoginUser, setupAdmin, testApp, testDb, type AuthedAgent } from "./helpers.js";

const CHICKEN = {
  name: "Chicken Breast",
  servingSize: 100,
  servingUnit: "g",
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
};

const RICE = {
  name: "White Rice (cooked)",
  servingSize: 1,
  servingUnit: "cup",
  calories: 205,
  protein: 4.3,
  carbs: 44.5,
  fat: 0.4,
};

async function addFood(agent: AuthedAgent, food: object): Promise<number> {
  const res = await agent.post("/api/foods").send(food).expect(201);
  return res.body.food.id;
}

describe("food library", () => {
  it("creates, searches, edits, and soft-deletes foods", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const id = await addFood(admin, CHICKEN);

    const found = await admin.get("/api/foods?search=chicken").expect(200);
    expect(found.body.foods).toHaveLength(1);

    await admin.patch(`/api/foods/${id}`).send({ calories: 170 }).expect(200);
    await admin.delete(`/api/foods/${id}`).expect(200);

    const gone = await admin.get("/api/foods").expect(200);
    expect(gone.body.foods).toHaveLength(0);
  });

  it("keeps foods private between users", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const id = await addFood(admin, CHICKEN);

    const bobList = await bob.get("/api/foods?search=chicken").expect(200);
    expect(bobList.body.foods).toHaveLength(0);
    await bob.patch(`/api/foods/${id}`).send({ calories: 1 }).expect(404);
    // Bob can't log the admin's food either.
    await bob
      .post("/api/food-log")
      .send({ foodId: id, date: "2026-07-25", meal: "lunch" })
      .expect(400);
  });
});

describe("daily log", () => {
  it("computes per-meal and day totals with serving multipliers", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const chickenId = await addFood(admin, CHICKEN);
    const riceId = await addFood(admin, RICE);

    await admin
      .post("/api/food-log")
      .send({ foodId: chickenId, date: "2026-07-25", meal: "lunch", servings: 1.5 })
      .expect(201);
    await admin
      .post("/api/food-log")
      .send({ foodId: riceId, date: "2026-07-25", meal: "lunch", servings: 2 })
      .expect(201);
    await admin
      .post("/api/food-log")
      .send({ foodId: chickenId, date: "2026-07-25", meal: "dinner", servings: 1 })
      .expect(201);

    const day = await admin.get("/api/food-log/day/2026-07-25").expect(200);
    // Lunch: 165*1.5 + 205*2 = 247.5 + 410 = 657.5
    expect(day.body.meals.lunch.calories).toBe(657.5);
    expect(day.body.meals.lunch.protein).toBe(55.1); // 46.5 + 8.6
    expect(day.body.meals.dinner.calories).toBe(165);
    expect(day.body.totals.calories).toBe(822.5);
    expect(day.body.entries).toHaveLength(3);

    // Other days are unaffected.
    const other = await admin.get("/api/food-log/day/2026-07-26").expect(200);
    expect(other.body.entries).toHaveLength(0);
    expect(other.body.totals.calories).toBe(0);
  });

  it("edits servings and deletes entries", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const id = await addFood(admin, CHICKEN);
    const entry = (
      await admin
        .post("/api/food-log")
        .send({ foodId: id, date: "2026-07-25", meal: "breakfast", servings: 1 })
    ).body.entry;

    await admin.patch(`/api/food-log/${entry.id}`).send({ servings: 2 }).expect(200);
    let day = await admin.get("/api/food-log/day/2026-07-25").expect(200);
    expect(day.body.totals.calories).toBe(330);

    await admin.delete(`/api/food-log/${entry.id}`).expect(200);
    day = await admin.get("/api/food-log/day/2026-07-25").expect(200);
    expect(day.body.entries).toHaveLength(0);
  });

  it("copies a day and a single meal", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const id = await addFood(admin, CHICKEN);
    await admin
      .post("/api/food-log")
      .send({ foodId: id, date: "2026-07-25", meal: "breakfast", servings: 1 });
    await admin
      .post("/api/food-log")
      .send({ foodId: id, date: "2026-07-25", meal: "lunch", servings: 2 });

    await admin
      .post("/api/food-log/copy")
      .send({ fromDate: "2026-07-25", toDate: "2026-07-26" })
      .expect(201);
    const day = await admin.get("/api/food-log/day/2026-07-26").expect(200);
    expect(day.body.entries).toHaveLength(2);

    await admin
      .post("/api/food-log/copy")
      .send({ fromDate: "2026-07-25", toDate: "2026-07-27", meal: "lunch" })
      .expect(201);
    const day2 = await admin.get("/api/food-log/day/2026-07-27").expect(200);
    expect(day2.body.entries).toHaveLength(1);
    expect(day2.body.entries[0].meal).toBe("lunch");

    await admin
      .post("/api/food-log/copy")
      .send({ fromDate: "2026-01-01", toDate: "2026-07-28" })
      .expect(400);
  });

  it("tracks recent foods in recency order", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const chickenId = await addFood(admin, CHICKEN);
    const riceId = await addFood(admin, RICE);
    await admin
      .post("/api/food-log")
      .send({ foodId: chickenId, date: "2026-07-25", meal: "lunch" });
    await admin
      .post("/api/food-log")
      .send({ foodId: riceId, date: "2026-07-25", meal: "lunch" });

    const recent = await admin.get("/api/foods/recent").expect(200);
    expect(recent.body.foods.map((f: { id: number }) => f.id)).toEqual([
      riceId,
      chickenId,
    ]);
  });
});

describe("Open Food Facts lookup", () => {
  function appWithOff(fetchImpl: FetchLike) {
    const db = testDb();
    return { app: buildApp(db, "/nonexistent-client-dist", { offFetch: fetchImpl }) };
  }

  const fakeProduct = {
    code: "123456",
    product_name: "Test Yogurt",
    brands: "TestBrand, Other",
    nutriments: {
      "energy-kcal_100g": 59,
      proteins_100g: 10.2,
      carbohydrates_100g: 3.6,
      fat_100g: 0.4,
      sodium_100g: 0.036,
    },
  };

  it("maps barcode lookups on a per-100g basis", async () => {
    const { app } = appWithOff(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 1, product: fakeProduct }),
    }));
    const agent = request.agent(app);
    await agent.post("/api/auth/setup").send({ username: "admin", password: "password123" });

    const res = await agent.get("/api/lookup/off?barcode=123456").expect(200);
    expect(res.body.results).toHaveLength(1);
    const r = res.body.results[0];
    expect(r.name).toBe("Test Yogurt");
    expect(r.brand).toBe("TestBrand");
    expect(r.servingSize).toBe(100);
    expect(r.servingUnit).toBe("g");
    expect(r.calories).toBe(59);
    expect(r.sodium).toBe(36); // g → mg
  });

  it("prefers per-serving nutrition when the product declares it", async () => {
    const babybel = {
      code: "3073780969000",
      product_name: "Mini Babybel",
      brands: ["Babybel"],
      serving_quantity: 20,
      serving_quantity_unit: "g",
      nutriments: {
        "energy-kcal_100g": 299,
        "energy-kcal_serving": 60,
        proteins_100g: 20.5,
        proteins_serving: 4.1,
        fat_100g: 24,
        fat_serving: 4.8,
        carbohydrates_100g: 0.5,
        carbohydrates_serving: 0.1,
      },
    };
    const { app } = appWithOff(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hits: [babybel] }),
    }));
    const agent = request.agent(app);
    await agent.post("/api/auth/setup").send({ username: "admin", password: "password123" });

    const res = await agent.get("/api/lookup/off?q=babybel").expect(200);
    const r = res.body.results[0];
    expect(r.servingSize).toBe(20);
    expect(r.servingUnit).toBe("g");
    expect(r.calories).toBe(60);
    expect(r.protein).toBe(4.1);
    expect(r.brand).toBe("Babybel");
  });

  it("maps name searches (hits array) and skips nameless products", async () => {
    const { app } = appWithOff(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hits: [fakeProduct, { code: "999", nutriments: {} }] }),
    }));
    const agent = request.agent(app);
    await agent.post("/api/auth/setup").send({ username: "admin", password: "password123" });

    const res = await agent.get("/api/lookup/off?q=yogurt").expect(200);
    expect(res.body.results).toHaveLength(1);
  });

  it("sends a User-Agent header to Open Food Facts", async () => {
    let seenUA = "";
    const { app } = appWithOff(async (_url, init) => {
      seenUA = init?.headers?.["User-Agent"] ?? "";
      return { ok: true, status: 200, json: async () => ({ hits: [] }) };
    });
    const agent = request.agent(app);
    await agent.post("/api/auth/setup").send({ username: "admin", password: "password123" });
    await agent.get("/api/lookup/off?q=yogurt").expect(200);
    expect(seenUA).toContain("HealthApp");
  });

  it("degrades gracefully when the upstream is down", async () => {
    const { app } = appWithOff(async () => {
      throw new Error("network down");
    });
    const agent = request.agent(app);
    await agent.post("/api/auth/setup").send({ username: "admin", password: "password123" });

    const res = await agent.get("/api/lookup/off?q=yogurt");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("LOOKUP_UNAVAILABLE");
  });

  it("handles upstream 500s and missing barcodes", async () => {
    const { app } = appWithOff(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    const agent = request.agent(app);
    await agent.post("/api/auth/setup").send({ username: "admin", password: "password123" });
    const res = await agent.get("/api/lookup/off?q=yogurt");
    expect(res.status).toBe(502);

    const { app: app2 } = appWithOff(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 0 }),
    }));
    const agent2 = request.agent(app2);
    await agent2.post("/api/auth/setup").send({ username: "admin", password: "password123" });
    const notFound = await agent2.get("/api/lookup/off?barcode=000").expect(200);
    expect(notFound.body.results).toHaveLength(0);
  });
});
