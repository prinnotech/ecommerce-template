import { z } from "zod";

import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import { slug_schema } from "@repo/core/lib/schemas/catalog";
import { EMPTY_SEO, seo_schema } from "@repo/core/lib/schemas/seo";
import { url_or_path_schema } from "@repo/core/lib/schemas/theme";

// Content → Blog posts. The body is a list of blocks (no HTML), each text per store language.

const block_id_schema = z.string().min(1).max(40);

export const blog_block_schema = z.discriminatedUnion("type", [
  z.object({ id: block_id_schema, type: z.literal("heading"), text: localized_text_schema }),
  // Plain text: a blank line starts a new paragraph.
  z.object({ id: block_id_schema, type: z.literal("paragraph"), text: localized_text_schema }),
  z.object({
    id: block_id_schema,
    type: z.literal("image"),
    url: url_or_path_schema,
    alt: localized_text_schema,
    caption: localized_text_schema,
  }),
  z.object({
    id: block_id_schema,
    type: z.literal("quote"),
    text: localized_text_schema,
    cite: z.string().trim().max(120),
  }),
]);
export type BlogBlock = z.infer<typeof blog_block_schema>;
export const BLOG_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "image",
  "quote",
] as const satisfies readonly BlogBlock["type"][];
export const MAX_BLOG_BLOCKS = 100;

export const blog_body_schema = z.array(blog_block_schema).max(MAX_BLOG_BLOCKS);

// Lower-case words and dashes, so a tag is also its URL (/blog/tags/<tag>).
export const tag_schema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, "invalid_tag")
  .max(40);
export const MAX_BLOG_TAGS = 20;

// "Summer Sale!" → "summer-sale".
export function toTag(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const iso_or_empty = z.union([z.iso.datetime({ offset: true }), z.literal("")]);

function hasText(text: LocalizedText): boolean {
  return Object.values(text).some((value) => value.trim().length > 0);
}

export const blog_post_input_schema = z
  .object({
    title: localized_text_schema,
    slug: slug_schema,
    excerpt: localized_text_schema,
    body: blog_body_schema,
    cover_url: url_or_path_schema,
    cover_alt: localized_text_schema,
    tags: z.array(tag_schema).max(MAX_BLOG_TAGS),
    author: z.string().trim().max(80),
    seo: seo_schema,
    is_published: z.boolean(),
    // When it appears on the store; empty = when it is first published. A future date schedules it.
    published_at: iso_or_empty,
  })
  .refine((input) => hasText(input.title), { path: ["title"] });
export type BlogPostInput = z.infer<typeof blog_post_input_schema>;

export const BLOG_POST_STATUSES = ["published", "scheduled", "draft"] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export function blogPostStatus(
  post: { is_published: boolean; published_at: string },
  now = Date.now(),
): BlogPostStatus {
  if (!post.is_published) return "draft";
  return post.published_at && new Date(post.published_at).getTime() > now ? "scheduled" : "published";
}

export const blog_list_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(["all", ...BLOG_POST_STATUSES]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type BlogListFilters = z.infer<typeof blog_list_filters_schema>;

export const store_blog_filters_schema = z.object({
  tag: z.union([tag_schema, z.literal("")]).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type StoreBlogFilters = z.infer<typeof store_blog_filters_schema>;

export const EMPTY_BLOG_POST: BlogPostInput = {
  title: {},
  slug: "",
  excerpt: {},
  body: [],
  cover_url: "",
  cover_alt: {},
  tags: [],
  author: "",
  seo: EMPTY_SEO,
  is_published: false,
  published_at: "",
};
