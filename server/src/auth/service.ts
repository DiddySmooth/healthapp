import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import {
  defaultUserSettings,
  users,
  type User,
  type UserSettings,
} from "../db/schema.js";

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...pub } = user;
  // Merge defaults so users created before new settings keys existed
  // still present a complete settings object.
  return { ...pub, settings: { ...defaultUserSettings, ...pub.settings } };
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function userCount(db: Db): number {
  return db.select({ n: count() }).from(users).get()?.n ?? 0;
}

// Case-insensitive: people rarely remember how they capitalized their
// username at signup. Also used by the duplicate check at creation, so
// "Grayson" and "grayson" cannot coexist.
export function findUserByUsername(db: Db, username: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .get();
}

export function findUserById(db: Db, id: number): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function createUser(
  db: Db,
  input: {
    username: string;
    password: string;
    role: "admin" | "user";
    settings?: Partial<UserSettings>;
  },
): User {
  return db
    .insert(users)
    .values({
      username: input.username,
      passwordHash: hashPassword(input.password),
      role: input.role,
      settings: { ...defaultUserSettings, ...input.settings },
    })
    .returning()
    .get();
}
