import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { ThemeRecord, ThemesBackend, ThemeVersion } from "@repo/core/backend/types";
import type { SqlContext } from "@repo/backend-sql/context";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

const COLUMNS = [
  "id",
  "name",
  "template",
  "draft",
  "published",
  "history",
  "is_live",
  "published_at",
  "created_at",
  "updated_at",
] as const;

function toTheme(row: Record<(typeof COLUMNS)[number], unknown>): ThemeRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    template: String(row.template),
    draft: json<unknown>(row.draft, null),
    published: json<unknown>(row.published, null),
    history: json<ThemeVersion[]>(row.history, []),
    is_live: bool(row.is_live),
    published_at: row.published_at ? iso(String(row.published_at)) : "",
    created_at: iso(String(row.created_at)),
    updated_at: iso(String(row.updated_at)),
  };
}

export function createThemes({ db }: SqlContext): ThemesBackend {
  async function get(id: string) {
    const row = await db
      .selectFrom("themes")
      .select([...COLUMNS])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toTheme(row) : null;
  }

  return {
    async list() {
      const rows = await db
        .selectFrom("themes")
        .select([...COLUMNS])
        .orderBy("is_live", "desc")
        .orderBy("updated_at", "desc")
        .execute();
      return rows.map(toTheme);
    },

    get,

    async getLive() {
      const row = await db
        .selectFrom("themes")
        .select(["template", "published"])
        .where("is_live", "=", true)
        .executeTakeFirst();
      return row ? { template: String(row.template), published: json<unknown>(row.published, null) } : null;
    },

    async create(fields) {
      const id = newId();
      await db
        .insertInto("themes")
        .values({ id, ...fields, published: null, history: [], is_live: false })
        .execute();
      const created = await get(id);
      if (!created) throw new Error("theme disappeared after insert");
      return created;
    },

    async update(id, fields) {
      const result = await db
        .updateTable("themes")
        .set({ ...fields, published_at: fields.published_at || undefined, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    // One transaction, so the store never sees two live themes (or none) in between.
    async setLive(id) {
      await db.transaction().execute(async (trx) => {
        const theme = await trx.selectFrom("themes").select(["id"]).where("id", "=", id).executeTakeFirst();
        if (!theme) throw new BackendError("not_found");
        await trx
          .updateTable("themes")
          .set({ is_live: false })
          .where("is_live", "=", true)
          .where("id", "!=", id)
          .execute();
        await trx.updateTable("themes").set({ is_live: true, updated_at: nowIso() }).where("id", "=", id).execute();
      });
    },

    async remove(id) {
      const result = await db.deleteFrom("themes").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },
  };
}
