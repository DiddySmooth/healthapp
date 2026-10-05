import { and, like, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// Word-based name search: every word must appear somewhere in the name, in
// any order ("cable fly" finds "Cable Rear Delt Fly"). A trailing "s" is
// dropped from longer words so "flys"/"curls" match "Flyes"/"Curl".
export function nameSearch(column: AnySQLiteColumn, search: string): SQL | undefined {
  const words = search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  if (words.length === 0) return undefined;
  return and(...words.map((w) => like(column, `%${w}%`)));
}
