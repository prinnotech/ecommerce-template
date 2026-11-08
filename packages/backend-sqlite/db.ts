import { Kysely, SqliteDialect } from "kysely";

import type { Database } from "@repo/backend-sql/schema";
import { ValuesPlugin } from "@repo/backend-sql/values";
import { sqlitePath } from "@repo/backend-sqlite/config";
import { openSqlite } from "@repo/backend-sqlite/driver";

// One connection per server process (kept on globalThis so dev hot reloads don't reopen it).
// Not "server-only": the proxy reads public settings through it too.
const global_for_db = globalThis as unknown as { sqlite_db?: Kysely<Database> };

export function getDatabase(): Kysely<Database> {
  global_for_db.sqlite_db ??= new Kysely<Database>({
    dialect: new SqliteDialect({ database: openSqlite(sqlitePath()) }),
    plugins: [new ValuesPlugin("sqlite")],
  });
  return global_for_db.sqlite_db;
}
