// SQLite settings (BACKEND=sqlite). Shared by server code, the proxy and the setup script.
//   SQLITE_PATH   the database file (default: <repo>/data/store.db). Store and admin must use the same file.
//   UPLOADS_DIR   where images are saved (default: <repo>/data/uploads); served at /media/… by both apps.
//   RESEND_API_KEY, EMAIL_FROM   send password-reset emails through Resend. Without them the
//                                reset link is written to the server log (fine for development).
import { existsSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE_NAME = "store_session";
export const MEDIA_ROUTE = "/media";

// The monorepo root (where package-lock.json is), so both apps find the same files by default.
function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth++) {
    if (existsSync(path.join(dir, "package-lock.json"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function sqlitePath(): string {
  return path.resolve(process.env.SQLITE_PATH ?? path.join(repoRoot(), "data", "store.db"));
}

export function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? path.join(repoRoot(), "data", "uploads"));
}
