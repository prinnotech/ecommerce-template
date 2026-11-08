import { sql, type Expression, type Kysely, type RawBuilder, type SqlBool } from "kysely";

import type { Page } from "@repo/core/backend/types";
import type { SqlDialectName } from "@repo/backend-sql/migrations";
import type { Database } from "@repo/backend-sql/schema";

// Where images live: Supabase Storage, or a local folder for SQLite.
export type FileStorage = {
  // Stores the file under `folder` and returns its path (what the database keeps).
  upload(folder: string, file: File): Promise<string>;
  remove(paths: string[]): Promise<void>;
  // Public URL; `width` asks for a smaller rendition where the storage supports it.
  url(path: string, width?: number): string;
};

export type SqlContext = {
  db: Kysely<Database>;
  dialect: SqlDialectName;
  storage: FileStorage;
};

// Case-insensitive "contains". JSON columns (localized text) are searched as text.
export function contains(ctx: SqlContext, column: Expression<unknown> | string, text: string): RawBuilder<SqlBool> {
  const ref = typeof column === "string" ? sql.ref(column) : column;
  const pattern = `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return ctx.dialect === "postgres"
    ? sql<SqlBool>`${ref}::text ilike ${pattern}`
    : sql<SqlBool>`${ref} like ${pattern} escape '\\'`;
}

// Runs a count and a page of rows; both callbacks must apply the same filters.
export async function paginate<Row>(
  page: number,
  page_size: number,
  count: () => Promise<number>,
  rows: (offset: number, limit: number) => Promise<Row[]>,
): Promise<Page<Row>> {
  const total_items = await count();
  const total_pages = Math.max(1, Math.ceil(total_items / page_size));
  const safe_page = Math.min(Math.max(page, 1), total_pages);
  return {
    items: await rows((safe_page - 1) * page_size, page_size),
    page: safe_page,
    total_pages,
    total_items,
  };
}

export function toCount(row: { count: string | number | bigint } | undefined): number {
  return Number(row?.count ?? 0);
}
