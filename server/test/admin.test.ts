import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAndLoginUser, setupAdmin, testApp } from "./helpers.js";

describe("password change", () => {
  it("changes own password after verifying the current one", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app, "admin", "password123");

    await admin
      .post("/api/auth/password")
      .send({ currentPassword: "wrong-password", newPassword: "newpassword1" })
      .expect(403);

    await admin
      .post("/api/auth/password")
      .send({ currentPassword: "password123", newPassword: "newpassword1" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "password123" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "newpassword1" })
      .expect(200);
  });

  it("rejects weak new passwords", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    await admin
      .post("/api/auth/password")
      .send({ currentPassword: "password123", newPassword: "short" })
      .expect(400);
  });
});

describe("backup", () => {
  it("streams a valid SQLite file to admins only", async () => {
    const { app } = testApp();
    const admin = await setupAdmin(app);
    const bob = await createAndLoginUser(app, admin, "bob");

    await bob.get("/api/admin/backup").expect(403);

    const res = await admin
      .get("/api/admin/backup")
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const body = res.body as Buffer;
    // SQLite files start with the magic string "SQLite format 3\0".
    expect(body.subarray(0, 15).toString("utf-8")).toBe("SQLite format 3");
    expect(res.headers["content-disposition"]).toContain("healthapp-backup-");
  });
});
