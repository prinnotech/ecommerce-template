import "server-only";

import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import type { Database } from "@repo/backend-sql/schema";
import { ValuesPlugin } from "@repo/backend-sql/values";

// Timestamps as ISO strings and counts/sums as numbers, like the other backends.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

// One pool per server process (kept on globalThis so dev hot reloads don't open new pools).
const global_for_db = globalThis as unknown as { supabase_db?: Kysely<Database> };

export function getDatabase(): Kysely<Database> {
  if (global_for_db.supabase_db) return global_for_db.supabase_db;
  const connection_string = process.env.DATABASE_URL;
  if (!connection_string) throw new Error("DATABASE_URL is not set (Supabase → Connect → connection string)");
  global_for_db.supabase_db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: connection_string, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) }),
    }),
    plugins: [new ValuesPlugin("postgres")],
  });
  return global_for_db.supabase_db;
}
