import "server-only";

import type { ExpressionBuilder, Selectable } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { BlogBackend, BlogPostFields, BlogPostRecord } from "@repo/core/backend/types";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import type { BlogPostsTable, Database } from "@repo/backend-sql/schema";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

type Row = Selectable<BlogPostsTable>;
type Eb = ExpressionBuilder<Database, "blog_posts">;

function toRecord(row: Row): BlogPostRecord {
  const tags = json<unknown>(row.tags, []);
  return {
    id: row.id,
    title: json(row.title, {}),
    slug: row.slug,
    excerpt: json(row.excerpt, {}),
    body: json(row.body, []),
    cover_url: row.cover_url,
    cover_alt: json(row.cover_alt, {}),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    author: row.author,
    seo: json(row.seo, null),
    is_published: bool(row.is_published),
    published_at: iso(row.published_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function columns(fields: BlogPostFields) {
  return { ...fields, published_at: fields.published_at || null };
}

function slugTaken(error: unknown): never {
  if (uniqueViolation(error)?.includes("slug")) throw new BackendError("slug_taken");
  throw error;
}

// Live on the store: published, and its date has come.
function isLive(eb: Eb, now: string) {
  return eb.and([eb("is_published", "=", true), eb("published_at", "is not", null), eb("published_at", "<=", now)]);
}

export function createBlog(ctx: SqlContext): BlogBackend {
  const { db } = ctx;

  async function row(id: string): Promise<Row> {
    const found = await db.selectFrom("blog_posts").selectAll().where("id", "=", id).executeTakeFirst();
    if (!found) throw new BackendError("not_found");
    return found;
  }

  return {
    async list(filters, page_size, now) {
      let query = db.selectFrom("blog_posts");
      if (filters.status === "draft") query = query.where("is_published", "=", false);
      if (filters.status === "published") query = query.where((eb) => isLive(eb, now));
      if (filters.status === "scheduled") {
        query = query.where("is_published", "=", true).where("published_at", ">", now);
      }
      if (filters.search) {
        const search = filters.search;
        query = query.where((eb) => eb.or([contains(ctx, "title", search), contains(ctx, "slug", search)]));
      }
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query
              .selectAll()
              .orderBy((eb) => eb.fn.coalesce("published_at", "created_at"), "desc")
              .orderBy("id")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map(toRecord),
      );
    },

    async get(id) {
      return toRecord(await row(id));
    },

    async create(fields) {
      const id = newId();
      await db
        .insertInto("blog_posts")
        .values({ id, ...columns(fields) })
        .execute()
        .catch(slugTaken);
      return { id };
    },

    async update(id, fields) {
      await row(id);
      await db
        .updateTable("blog_posts")
        .set({ ...columns(fields), updated_at: nowIso() })
        .where("id", "=", id)
        .execute()
        .catch(slugTaken);
    },

    async remove(id) {
      const result = await db.deleteFrom("blog_posts").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },

    async listPublished(filters, page_size, now) {
      let query = db.selectFrom("blog_posts").where((eb) => isLive(eb, now));
      // Tags are a JSON list of strings: match the quoted tag.
      if (filters.tag) query = query.where(contains(ctx, "tags", `"${filters.tag}"`));
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query.selectAll().orderBy("published_at", "desc").orderBy("id").offset(offset).limit(limit).execute()
          ).map(toRecord),
      );
    },

    async getPublishedBySlug(slug, now) {
      const found = await db
        .selectFrom("blog_posts")
        .selectAll()
        .where("slug", "=", slug)
        .where((eb) => isLive(eb, now))
        .executeTakeFirst();
      return found ? toRecord(found) : null;
    },
  };
}
