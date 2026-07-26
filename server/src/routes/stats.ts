import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { exerciseHistory, exercisePRs } from "../lib/stats.js";

export function statsRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth(db));

  router.get("/exercise/:exerciseId", (req, res) => {
    const exerciseId = Number(req.params.exerciseId);
    res.json({
      history: exerciseHistory(db, req.user!.id, exerciseId),
      prs: exercisePRs(db, req.user!.id, exerciseId),
    });
  });

  return router;
}
