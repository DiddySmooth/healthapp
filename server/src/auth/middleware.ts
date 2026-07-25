import type { NextFunction, Request, Response } from "express";
import type { Db } from "../db/index.js";
import type { User } from "../db/schema.js";
import { ApiError } from "../lib/errors.js";
import { findUserById } from "./service.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export function requireAuth(db: Db) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userId = req.session.userId;
    if (userId == null) return next(new ApiError(401, "UNAUTHORIZED", "Not logged in"));
    const user = findUserById(db, userId);
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return next(new ApiError(401, "UNAUTHORIZED", "Not logged in"));
    }
    req.user = user;
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    return next(new ApiError(403, "FORBIDDEN", "Admin access required"));
  }
  next();
}
