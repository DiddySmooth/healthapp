import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { apiTokens } from "../db/schema.js";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issueToken(db: Db, userId: number, deviceName: string | null): string {
  const token = crypto.randomBytes(32).toString("base64url");
  db.insert(apiTokens)
    .values({ userId, tokenHash: hashToken(token), deviceName })
    .run();
  return token;
}

// Returns the owning user id, bumping lastUsedAt; undefined if unknown.
export function resolveToken(db: Db, token: string): number | undefined {
  const row = db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .returning({ userId: apiTokens.userId })
    .get();
  return row?.userId;
}

export function revokeToken(db: Db, token: string): void {
  db.delete(apiTokens).where(eq(apiTokens.tokenHash, hashToken(token))).run();
}

export function revokeUserTokens(db: Db, userId: number): void {
  db.delete(apiTokens).where(eq(apiTokens.userId, userId)).run();
}

export function bearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}
