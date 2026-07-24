import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import type { Db } from "./db/index.js";
import { config } from "./config.js";

export function buildApp(db: Db, clientDist: string = config.clientDist): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API routes mount here in later phases.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown API route" } });
  });

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA history fallback for non-API GET requests.
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
