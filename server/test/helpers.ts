import type { Express } from "express";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { migrateDb, openDb, type Db } from "../src/db/index.js";

// Fresh in-memory database with all migrations applied.
export function testDb(): Db {
  const db = openDb(":memory:");
  migrateDb(db);
  return db;
}

export function testApp(db: Db = testDb()): { app: Express; db: Db } {
  return { app: buildApp(db, "/nonexistent-client-dist"), db };
}

// Cookie-persisting client for session-based request flows.
export type AuthedAgent = ReturnType<typeof request.agent>;

export async function setupAdmin(
  app: Express,
  username = "admin",
  password = "password123",
): Promise<AuthedAgent> {
  const agent = request.agent(app);
  await agent.post("/api/auth/setup").send({ username, password }).expect(201);
  return agent;
}

// Admin creates a normal user; returns a logged-in agent for that user.
export async function createAndLoginUser(
  app: Express,
  admin: AuthedAgent,
  username: string,
  password = "password123",
): Promise<AuthedAgent> {
  await admin.post("/api/users").send({ username, password }).expect(201);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ username, password }).expect(200);
  return agent;
}
