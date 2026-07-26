import { Router } from "express";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";

export function adminRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db), requireAdmin);

  // Consistent point-in-time snapshot of the whole database.
  router.get("/backup", (_req, res) => {
    const raw = (db as unknown as { $client: { serialize(): Buffer } }).$client;
    const buffer = raw.serialize();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="healthapp-backup-${stamp}.db"`,
    );
    res.send(buffer);
  });

  return router;
}
