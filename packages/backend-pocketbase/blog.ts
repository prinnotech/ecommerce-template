import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { BlogBackend, BlogPostRecord } from "@repo/core/backend/types";
import type { BlogListFilters } from "@repo/core/lib/schemas/blog";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { BlogPostsResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

// Blog posts are locked to the server (null rules): the store reads published ones here.

const pbDate = (iso: string) => iso.replace("T", " ");

function toRecord(record: BlogPostsResponse): BlogPostRecord {
  return {
    id: record.id,
    title: record.title ?? {},
    slug: record.slug,
    excerpt: record.excerpt ?? {},
    body: record.body ?? [],
    cover_url: record.cover_url,
    cover_alt: record.cover_alt ?? {},
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
    author: record.author,
    seo: record.seo ?? null,
    is_published: record.is_published,
    published_at: record.published_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function rethrow(error: unknown): never {
  if (pocketBaseFieldCode(error, "slug") === "validation_not_unique") throw new BackendError("slug_taken");
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

const LIVE = 'is_published = true && published_at != "" && published_at <= {:now}';

function adminFilter(pb: TypedPocketBase, filters: BlogListFilters, now: string): string {
  const parts: string[] = [];
  const params = { now: pbDate(now) };
  if (filters.status === "draft") parts.push("is_published = false");
  if (filters.status === "published") parts.push(pb.filter(LIVE, params));
  if (filters.status === "scheduled") parts.push(pb.filter("is_published = true && published_at > {:now}", params));
  if (filters.search) parts.push(pb.filter("(title ~ {:search} || slug ~ {:search})", { search: filters.search }));
  return parts.join(" && ");
}

export const blog: BlogBackend = {
  async list(filters, page_size, now) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("blog_posts").getList(filters.page, page_size, {
      filter: adminFilter(pb, filters, now),
      // Unpublished posts have no date: they sort by creation among themselves, after dated ones.
      sort: "-published_at,-created_at,id",
    });
    return {
      items: result.items.map(toRecord),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    return toRecord(await pb.collection("blog_posts").getOne(id).catch(rethrow));
  },

  async create(fields) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("blog_posts").create(fields).catch(rethrow);
    return { id: record.id };
  },

  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("blog_posts").update(id, fields).catch(rethrow);
  },

  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("blog_posts").delete(id).catch(rethrow);
  },

  async listPublished(filters, page_size, now) {
    const pb = await createAdminPocketBase();
    const parts = [pb.filter(LIVE, { now: pbDate(now) })];
    // Tags are a JSON list of strings: match the quoted tag.
    if (filters.tag) parts.push(pb.filter("tags ~ {:tag}", { tag: `"${filters.tag}"` }));
    const result = await pb.collection("blog_posts").getList(filters.page, page_size, {
      filter: parts.join(" && "),
      sort: "-published_at,id",
    });
    return {
      items: result.items.map(toRecord),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async getPublishedBySlug(slug, now) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("blog_posts").getList(1, 1, {
      filter: pb.filter(`slug = {:slug} && ${LIVE}`, { slug, now: pbDate(now) }),
    });
    const record = result.items[0];
    return record ? toRecord(record) : null;
  },
};
