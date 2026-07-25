import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAndLoginUser, setupAdmin, testApp } from "./helpers.js";

describe("setup", () => {
  it("reports needsSetup until an admin exists", async () => {
    const { app } = testApp();
    const before = await request(app).get("/api/auth/status").expect(200);
    expect(before.body.needsSetup).toBe(true);

    await setupAdmin(app);

    const after = await request(app).get("/api/auth/status").expect(200);
    expect(after.body.needsSetup).toBe(false);
  });

  it("creates an admin and logs them in", async () => {
    const { app } = testApp();
    const agent = await setupAdmin(app, "grayson");
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user.username).toBe("grayson");
    expect(me.body.user.role).toBe("admin");
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it("refuses to run twice", async () => {
    const { app } = testApp();
    await setupAdmin(app);
    const res = await request(app)
      .post("/api/auth/setup")
      .send({ username: "sneaky", password: "password123" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SETUP_DONE");
  });

  it("rejects weak passwords and bad usernames", async () => {
    const { app } = testApp();
    await request(app)
      .post("/api/auth/setup")
      .send({ username: "ok", password: "password123" })
      .expect(400);
    await request(app)
      .post("/api/auth/setup")
      .send({ username: "admin", password: "short" })
      .expect(400);
  });
});

describe("login/logout", () => {
  it("full session lifecycle", async () => {
    const { app } = testApp();
    await setupAdmin(app, "admin", "password123");

    const agent = request.agent(app);
    await agent.get("/api/auth/me").expect(401);
    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "password123" })
      .expect(200);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("rejects wrong password without leaking which field was wrong", async () => {
    const { app } = testApp();
    await setupAdmin(app);
    const wrongPass = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong-password" });
    const wrongUser = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "password123" });
    expect(wrongPass.status).toBe(401);
    expect(wrongUser.status).toBe(401);
    expect(wrongPass.body.error.code).toBe(wrongUser.body.error.code);
  });

  it("blocks deactivated users at login and kills their session", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const bobId = (await bob.get("/api/auth/me")).body.user.id;

    await admin.patch(`/api/users/${bobId}`).send({ isActive: false }).expect(200);

    // Existing session is invalidated...
    await bob.get("/api/auth/me").expect(401);
    // ...and re-login is refused.
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "bob", password: "password123" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("DEACTIVATED");
  });
});

describe("user admin", () => {
  it("admin can create users; duplicates are rejected", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    await admin.post("/api/users").send({ username: "bob", password: "password123" }).expect(201);
    const dup = await admin
      .post("/api/users")
      .send({ username: "bob", password: "password123" });
    expect(dup.status).toBe(409);
  });

  it("non-admin users cannot access user management", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    await bob.get("/api/users").expect(403);
    await bob.post("/api/users").send({ username: "x", password: "password123" }).expect(403);
  });

  it("admin can reset a user's password", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");
    const bobId = (await bob.get("/api/auth/me")).body.user.id;

    await admin.patch(`/api/users/${bobId}`).send({ password: "newpassword1" }).expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ username: "bob", password: "password123" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "bob", password: "newpassword1" })
      .expect(200);
  });

  it("admin cannot deactivate or demote themselves", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const meId = (await admin.get("/api/auth/me")).body.user.id;
    const res = await admin.patch(`/api/users/${meId}`).send({ isActive: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SELF_LOCKOUT");
  });
});

describe("settings", () => {
  it("user can update their own settings", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const res = await admin
      .patch("/api/auth/me/settings")
      .send({ weightUnit: "kg", weekStart: "sunday" })
      .expect(200);
    expect(res.body.user.settings.weightUnit).toBe("kg");
    expect(res.body.user.settings.weekStart).toBe("sunday");
    // Untouched keys keep defaults.
    expect(res.body.user.settings.distanceUnit).toBe("mi");
  });

  it("rejects invalid settings values", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    await admin.patch("/api/auth/me/settings").send({ weightUnit: "stone" }).expect(400);
  });
});
