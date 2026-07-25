import { Store } from "express-session";
import type { SessionData } from "express-session";
import type { Db } from "../db/index.js";

type RawDb = { prepare(sql: string): any };

// Minimal express-session store on the sessions table. Uses the raw
// better-sqlite3 connection (synchronous) — callbacks fire immediately.
export class SqliteSessionStore extends Store {
  private db: RawDb;

  constructor(db: Db) {
    super();
    this.db = (db as unknown as { $client: RawDb }).$client;
    // Opportunistic cleanup of expired sessions on boot.
    this.db.prepare("DELETE FROM sessions WHERE expire < ?").run(Date.now());
  }

  get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = this.db
        .prepare("SELECT sess, expire FROM sessions WHERE sid = ?")
        .get(sid) as { sess: string; expire: number } | undefined;
      if (!row || row.expire < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.sess) as SessionData);
    } catch (e) {
      cb(e);
    }
  }

  set(sid: string, session: SessionData, cb?: (err?: unknown) => void): void {
    try {
      const expire =
        session.cookie?.expires != null
          ? new Date(session.cookie.expires).getTime()
          : Date.now() + 30 * 24 * 60 * 60 * 1000;
      this.db
        .prepare(
          "INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) " +
            "ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire",
        )
        .run(sid, JSON.stringify(session), expire);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  destroy(sid: string, cb?: (err?: unknown) => void): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  touch(sid: string, session: SessionData, cb?: (err?: unknown) => void): void {
    this.set(sid, session, cb);
  }
}
