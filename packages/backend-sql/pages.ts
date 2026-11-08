import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { MediaBackend, MediaItem, PageRecord, PagesBackend } from "@repo/core/backend/types";
import type { SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

const PAGE_COLUMNS = ["id", "title", "slug", "sections", "seo", "is_published", "created_at", "updated_at"] as const;

function toPage(row: Record<(typeof PAGE_COLUMNS)[number], unknown>): PageRecord {
  return {
    id: String(row.id),
    title: json<unknown>(row.title, {}),
    slug: String(row.slug),
    sections: json<unknown>(row.sections, []),
    seo: json<unknown>(row.seo, {}),
    is_published: bool(row.is_published),
    created_at: iso(String(row.created_at)),
    updated_at: iso(String(row.updated_at)),
  };
}

export function createPages({ db }: SqlContext): PagesBackend {
  async function get(id: string) {
    const row = await db
      .selectFrom("pages")
      .select([...PAGE_COLUMNS])
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toPage(row) : null;
  }

  return {
    async list() {
      const rows = await db
        .selectFrom("pages")
        .select([...PAGE_COLUMNS])
        .orderBy("updated_at", "desc")
        .execute();
      return rows.map(toPage);
    },

    get,

    async getPublishedBySlug(slug) {
      const row = await db
        .selectFrom("pages")
        .select([...PAGE_COLUMNS])
        .where("slug", "=", slug)
        .where("is_published", "=", true)
        .executeTakeFirst();
      return row ? toPage(row) : null;
    },

    async create(fields) {
      const id = newId();
      try {
        await db
          .insertInto("pages")
          .values({ id, ...fields, is_published: false })
          .execute();
      } catch (error) {
        if (uniqueViolation(error)) throw new BackendError("slug_taken");
        throw error;
      }
      const created = await get(id);
      if (!created) throw new Error("page disappeared after insert");
      return created;
    },

    async update(id, fields) {
      try {
        const result = await db
          .updateTable("pages")
          .set({ ...fields, updated_at: nowIso() })
          .where("id", "=", id)
          .executeTakeFirst();
        if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
      } catch (error) {
        if (uniqueViolation(error)) throw new BackendError("slug_taken");
        throw error;
      }
    },

    async remove(id) {
      const result = await db.deleteFrom("pages").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },
  };
}

export function createMedia({ db, storage }: SqlContext): MediaBackend {
  const toItem = (row: { id: string; path: string; name: string; size: number; created_at: unknown }): MediaItem => ({
    id: row.id,
    url: storage.url(row.path),
    name: row.name,
    size: Number(row.size),
    created_at: iso(String(row.created_at)),
  });

  return {
    async list() {
      const rows = await db
        .selectFrom("media")
        .select(["id", "path", "name", "size", "created_at"])
        .orderBy("created_at", "desc")
        .limit(500)
        .execute();
      return rows.map(toItem);
    },

    async upload(file) {
      const path = await storage.upload("media", file);
      const id = newId();
      const row = { id, path, name: file.name.slice(0, 200), size: file.size };
      await db.insertInto("media").values(row).execute();
      return toItem({ ...row, created_at: nowIso() });
    },

    async remove(id) {
      const row = await db.selectFrom("media").select(["path"]).where("id", "=", id).executeTakeFirst();
      if (!row) throw new BackendError("not_found");
      await db.deleteFrom("media").where("id", "=", id).execute();
      await storage.remove([row.path]);
    },
  };
}
