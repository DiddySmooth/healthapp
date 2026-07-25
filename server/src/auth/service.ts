import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
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
  return pub;
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

export function findUserByUsername(db: Db, username: string): User | undefined {
  return db.select().from(users).where(eq(users.username, username)).get();
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
