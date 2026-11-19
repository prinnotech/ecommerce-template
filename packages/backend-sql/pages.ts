import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { MediaBackend, MediaItem, PageRecord, PagesBackend } from "@repo/core/backend/types";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
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

type MediaRow = {
  id: string;
  path: string;
  name: string;
  alt: string;
  type: string;
  size: number;
  created_at: unknown;
};

const MEDIA_COLUMNS = ["id", "path", "name", "alt", "type", "size", "created_at"] as const;

export function createMedia(ctx: SqlContext): MediaBackend {
  const { db, storage } = ctx;
  const toItem = (row: MediaRow): MediaItem => ({
    id: row.id,
    url: storage.url(row.path),
    name: row.name,
    alt: row.alt ?? "",
    type: row.type ?? "",
    size: Number(row.size),
    created_at: iso(String(row.created_at)),
  });

  async function row(id: string): Promise<MediaRow> {
    const found = await db.selectFrom("media").select(MEDIA_COLUMNS).where("id", "=", id).executeTakeFirst();
    if (!found) throw new BackendError("not_found");
    return found;
  }

  return {
    async list(filters, page_size) {
      let query = db.selectFrom("media");
      if (filters.search) {
        const search = filters.search;
        query = query.where((eb) => eb.or([contains(ctx, "name", search), contains(ctx, "alt", search)]));
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query
              .select(MEDIA_COLUMNS)
              .orderBy("created_at", "desc")
              .orderBy("id")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map(toItem),
      );
    },

    async get(id) {
      return toItem(await row(id));
    },

    async upload(file) {
      const path = await storage.upload("media", file);
      const id = newId();
      const values = { id, path, name: file.name.slice(0, 200), size: file.size, alt: "", type: file.type };
      await db.insertInto("media").values(values).execute();
      return toItem({ ...values, created_at: nowIso() });
    },

    async update(id, fields) {
      await row(id);
      await db
        .updateTable("media")
        .set({ ...fields, updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
      return toItem(await row(id));
    },

    async remove(id) {
      const found = await row(id);
      await db.deleteFrom("media").where("id", "=", id).execute();
      await storage.remove([found.path]);
    },

    async read(id) {
      const found = await row(id);
      const blob = await storage.read(found.path);
      return new File([blob], found.name, { type: found.type || blob.type });
    },
  };
}
