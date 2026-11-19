"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { BlogPostRecord, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import {
  blog_body_schema,
  blog_list_filters_schema,
  blog_post_input_schema,
  blogPostStatus,
  store_blog_filters_schema,
  tag_schema,
  type BlogBlock,
  type BlogListFilters,
  type BlogPostInput,
  type BlogPostStatus,
  type StoreBlogFilters,
} from "@repo/core/lib/schemas/blog";
import { slug_schema } from "@repo/core/lib/schemas/catalog";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { parseSeo, type Seo } from "@repo/core/lib/schemas/seo";
import { revalidateStore } from "@repo/core/lib/store-revalidate";

// Content → Blog posts, and the store's /blog. Saved directly (no draft copy): a published post's
// changes are live at once; scheduled posts appear when their date comes.

export type BlogPost = {
  id: string;
  title: LocalizedText;
  slug: string;
  excerpt: LocalizedText;
  body: BlogBlock[];
  cover_url: string;
  cover_alt: LocalizedText;
  tags: string[];
  author: string;
  seo: Seo;
  is_published: boolean;
  published_at: string;
  status: BlogPostStatus;
  created_at: string;
  updated_at: string;
};

const ADMIN_PAGE_SIZE = 25;
const STORE_PAGE_SIZE = 12;

function text(value: unknown): LocalizedText {
  const parsed = localized_text_schema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

// Stored JSON is checked here, so a bad row never breaks a page: unreadable parts become empty.
function toPost(record: BlogPostRecord, now = Date.now()): BlogPost {
  const body = blog_body_schema.safeParse(record.body);
  return {
    id: record.id,
    title: text(record.title),
    slug: record.slug,
    excerpt: text(record.excerpt),
    body: body.success ? body.data : [],
    cover_url: record.cover_url,
    cover_alt: text(record.cover_alt),
    tags: record.tags.filter((tag) => tag_schema.safeParse(tag).success),
    author: record.author,
    seo: parseSeo(record.seo),
    is_published: record.is_published,
    published_at: record.published_at,
    status: blogPostStatus(record, now),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function toPage(page: Page<BlogPostRecord>): Page<BlogPost> {
  const now = Date.now();
  return { ...page, items: page.items.map((record) => toPost(record, now)) };
}

// A post published without a date goes out now; unpublishing keeps the date for next time.
function fieldsFrom(input: BlogPostInput) {
  return {
    ...input,
    tags: [...new Set(input.tags)],
    published_at: input.is_published && !input.published_at ? new Date().toISOString() : input.published_at,
  };
}

// ---------- Admin ----------

export async function getBlogPosts(input: Partial<BlogListFilters>): Promise<ActionResult<Page<BlogPost>>> {
  const auth = await authorize("blog.view", "view blog posts");
  if (!auth.ok) return auth;
  try {
    const filters = blog_list_filters_schema.parse(input);
    return ok(toPage(await getBackend().blog.list(filters, ADMIN_PAGE_SIZE, new Date().toISOString())));
  } catch (error) {
    return failFrom(error, "blog", "getBlogPosts");
  }
}

export async function getBlogPost(id: string): Promise<ActionResult<BlogPost>> {
  const auth = await authorize("blog.view", "view a blog post");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    return ok(toPost(await getBackend().blog.get(id)));
  } catch (error) {
    return failFrom(error, "blog", "getBlogPost");
  }
}

export async function createBlogPost(input: BlogPostInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("blog.edit", "create a blog post");
  if (!auth.ok) return auth;
  const parsed = blog_post_input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const created = await getBackend().blog.create(fieldsFrom(parsed.data));
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a blog post",
      target_type: "blog_posts",
      target_id: created.id,
      details: { slug: parsed.data.slug },
    });
    if (parsed.data.is_published) await revalidateStore();
    return ok(created);
  } catch (error) {
    return failFrom(error, "blog", "createBlogPost");
  }
}

export async function updateBlogPost(input: { id: string; post: BlogPostInput }): Promise<ActionResult<null>> {
  const auth = await authorize("blog.edit", "edit a blog post");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success) return fail("not_found");
  const parsed = blog_post_input_schema.safeParse(input.post);
  if (!parsed.success) return fail("invalid_input");
  try {
    await getBackend().blog.update(input.id, fieldsFrom(parsed.data));
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit a blog post",
      target_type: "blog_posts",
      target_id: input.id,
      details: { slug: parsed.data.slug, is_published: parsed.data.is_published },
    });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "blog", "updateBlogPost");
  }
}

export async function deleteBlogPost(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("blog.edit", "delete a blog post");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().blog.remove(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a blog post",
      target_type: "blog_posts",
      target_id: id,
    });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "blog", "deleteBlogPost");
  }
}

// ---------- Store (public) ----------

export async function getStoreBlogPosts(input: Partial<StoreBlogFilters>): Promise<ActionResult<Page<BlogPost>>> {
  try {
    const filters = store_blog_filters_schema.parse(input);
    return ok(toPage(await getBackend().blog.listPublished(filters, STORE_PAGE_SIZE, new Date().toISOString())));
  } catch (error) {
    return failFrom(error, "blog", "getStoreBlogPosts");
  }
}

// The "Latest posts" theme section.
export async function getLatestBlogPosts(limit: number, tag = ""): Promise<ActionResult<BlogPost[]>> {
  try {
    const filters = store_blog_filters_schema.parse({ tag, page: 1 });
    const page = await getBackend().blog.listPublished(
      filters,
      Math.min(Math.max(limit, 1), 12),
      new Date().toISOString(),
    );
    return ok(toPage(page).items);
  } catch (error) {
    return failFrom(error, "blog", "getLatestBlogPosts");
  }
}

export async function getStoreBlogPost(slug: string): Promise<ActionResult<BlogPost>> {
  if (!slug_schema.safeParse(slug).success) return fail("not_found");
  try {
    const record = await getBackend().blog.getPublishedBySlug(slug, new Date().toISOString());
    return record ? ok(toPost(record)) : fail("not_found");
  } catch (error) {
    return failFrom(error, "blog", "getStoreBlogPost");
  }
}

// The sitemap: every live post (up to 5,000).
export async function getBlogSlugs(): Promise<ActionResult<{ slug: string; updated_at: string; tags: string[] }[]>> {
  try {
    const now = new Date().toISOString();
    const slugs: { slug: string; updated_at: string; tags: string[] }[] = [];
    for (let page = 1; page <= 10; page++) {
      const result = await getBackend().blog.listPublished({ tag: "", page }, 500, now);
      slugs.push(...result.items.map((post) => ({ slug: post.slug, updated_at: post.updated_at, tags: post.tags })));
      if (page >= result.total_pages) break;
    }
    return ok(slugs);
  } catch (error) {
    return failFrom(error, "blog", "getBlogSlugs");
  }
}
