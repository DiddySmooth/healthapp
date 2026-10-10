import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupAdmin, testApp } from "./helpers.js";

describe("bearer tokens", () => {
  it("issues a token that authenticates without cookies", async () => {
    const { app } = testApp();
    await setupAdmin(app, "admin", "password123");

    const res = await request(app)
      .post("/api/auth/token")
      .send({ username: "ADMIN", password: "password123", deviceName: "iPhone" })
      .expect(201);
    expect(res.body.token).toMatch(/^[\w-]{40,}$/);
    expect(res.body.user.username).toBe("admin");
    expect(res.headers["set-cookie"]).toBeUndefined();

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.token}`)
      .expect(200);
    expect(me.body.user.username).toBe("admin");
  });

  it("rejects bad credentials and unknown tokens", async () => {
    const { app } = testApp();
    await setupAdmin(app);
    await request(app)
      .post("/api/auth/token")
      .send({ username: "admin", password: "wrongpassword" })
      .expect(401);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("revokes on DELETE /token", async () => {
    const { app } = testApp();
    await setupAdmin(app);
    const { body } = await request(app)
      .post("/api/auth/token")
      .send({ username: "admin", password: "password123" })
      .expect(201);
    const auth = `Bearer ${body.token}`;
    await request(app).delete("/api/auth/token").set("Authorization", auth).expect(200);
    await request(app).get("/api/auth/me").set("Authorization", auth).expect(401);
  });

  it("stops working when the user is deactivated or their password is reset", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const { body: created } = await admin
      .post("/api/users")
      .send({ username: "bob", password: "password123" })
      .expect(201);
    const login = () =>
      request(app)
        .post("/api/auth/token")
        .send({ username: "bob", password: "password123" })
        .expect(201)
        .then((r) => `Bearer ${r.body.token as string}`);

    const first = await login();
    await admin.patch(`/api/users/${created.user.id}`).send({ isActive: false }).expect(200);
    await request(app).get("/api/auth/me").set("Authorization", first).expect(401);
    await admin.patch(`/api/users/${created.user.id}`).send({ isActive: true }).expect(200);

    const second = await login();
    await request(app).get("/api/auth/me").set("Authorization", second).expect(200);
    await admin
      .patch(`/api/users/${created.user.id}`)
      .send({ password: "newpassword1" })
      .expect(200);
    await request(app).get("/api/auth/me").set("Authorization", second).expect(401);
  });
});
