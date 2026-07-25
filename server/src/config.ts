import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 3420),
  // In the container /data is the mounted volume; in dev, use ./data at the
  // repo root (gitignored).
  dataDir:
    process.env.DATA_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data"
      : path.join(import.meta.dirname, "..", "..", "data")),
  // Built SPA location; the Docker image copies the client build here.
  clientDist:
    process.env.CLIENT_DIST ?? path.join(import.meta.dirname, "public"),
};

export function dbPath(dataDir: string = config.dataDir): string {
  return path.join(dataDir, "healthapp.db");
}
