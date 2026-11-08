import "server-only";

import type { Backend } from "@repo/core/backend/types";
import { createSqlBackend } from "@repo/backend-sql/index";
import { sqlite_auth } from "@repo/backend-sqlite/auth";
import { getDatabase } from "@repo/backend-sqlite/db";
import { local_storage } from "@repo/backend-sqlite/storage";

let backend: Backend | null = null;

// SQLite (BACKEND=sqlite): one database file and a local images folder, built-in auth.
// Store and admin must run on the same server, sharing the file.
export function getSqliteBackend(): Backend {
  backend ??= createSqlBackend({
    name: "sqlite",
    context: { db: getDatabase(), dialect: "sqlite", storage: local_storage },
    auth: sqlite_auth,
  });
  return backend;
}
