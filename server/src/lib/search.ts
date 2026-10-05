import { and, like, or, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// Word-based search: every word must appear in at least one of the given
// columns, in any order — so "cable pulldown" matches "Wide-Grip Lat
// Pulldown" (equipment: cable) and "fly cable" matches "Cable Rear Delt
// Fly". A trailing "s" is dropped from longer words so "flys"/"curls"
// match "Flyes"/"Curl".
export function wordSearch(
  columns: AnySQLiteColumn[],
  search: string,
): SQL | undefined {
  const words = search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  if (words.length === 0) return undefined;
  return and(
    ...words.map((w) => or(...columns.map((c) => like(c, `%${w}%`)))),
  );
}

// Back-compat single-column form.
export function nameSearch(column: AnySQLiteColumn, search: string): SQL | undefined {
  return wordSearch([column], search);
}
