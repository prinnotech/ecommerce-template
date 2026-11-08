// Proxy helpers for SQLite. No "server-only": proxy.ts can't load server-only modules.
import { json } from "@repo/backend-sql/values";
import { getDatabase } from "@repo/backend-sqlite/db";

// Sessions live in the database with a fixed 30-day cookie: nothing to refresh on the way through.
export async function updateSession(): Promise<void> {}

// A public site setting, read straight from the database file.
export async function readPublicSetting(key: string): Promise<unknown> {
  const row = await getDatabase()
    .selectFrom("site_settings")
    .select(["value", "is_public"])
    .where("key", "=", key)
    .executeTakeFirst();
  if (!row || !row.is_public) return undefined;
  return json<unknown>(row.value, undefined);
}
