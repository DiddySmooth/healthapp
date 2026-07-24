import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 3420),
  dataDir: process.env.DATA_DIR ?? "/data",
  // Built SPA location; the Docker image copies the client build here.
  clientDist:
    process.env.CLIENT_DIST ?? path.join(import.meta.dirname, "public"),
};

export function dbPath(dataDir: string = config.dataDir): string {
  return path.join(dataDir, "healthapp.db");
}
