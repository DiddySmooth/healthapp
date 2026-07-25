import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny, type output } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): output<S> {
  try {
    return schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const issue = e.issues[0];
      const where = issue?.path.join(".") ?? "body";
      throw new ApiError(400, "VALIDATION", `${where}: ${issue?.message ?? "invalid"}`);
    }
    throw e;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}

// Express 4 doesn't catch async errors; wrap handlers.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
