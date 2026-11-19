import type { MetadataRoute } from "next";

import { getBlogSlugs } from "@repo/core/actions/blog";
import { getPublishedPages } from "@repo/core/actions/pages";
import { getCollectionSlugs, getProductSlugs, getStoreCategories } from "@repo/core/actions/storefront";
import { publishedLocales } from "@repo/core/lib/languages";
import { SITE_URL } from "@repo/core/lib/site-config";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// Refreshed hourly; product, category, custom pages and blog posts for every locale, with hreflang
// alternates.
export const revalidate = 3600;

function entry(locales: readonly string[], path: string, last_modified?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]));
  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    lastModified: last_modified ? new Date(last_modified) : undefined,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, pages, collections, posts, languages] = await Promise.all([
    getProductSlugs(),
    getStoreCategories(),
    getPublishedPages(),
    getCollectionSlugs(),
    getBlogSlugs(),
    getSiteSetting("LANGUAGES"),
  ]);
  const blog_posts = posts.ok ? posts.data : [];
  const tags = [...new Set(blog_posts.flatMap((post) => post.tags))];
  const locales = publishedLocales(languages);
  return [
    ...entry(locales, ""),
    ...entry(locales, "/shop"),
    ...entry(locales, "/about"),
    ...entry(locales, "/contact"),
    ...entry(locales, "/privacy"),
    ...entry(locales, "/terms"),
    ...(categories.ok ? categories.data : []).flatMap((category) => entry(locales, `/shop?category=${category.slug}`)),
    ...(products.ok ? products.data : []).flatMap((product) =>
      entry(locales, `/shop/${product.slug}`, product.updated_at),
    ),
    ...(pages.ok ? pages.data : []).flatMap((page) => entry(locales, `/pages/${page.slug}`, page.updated_at)),
    ...(collections.ok ? collections.data : []).flatMap((item) =>
      entry(locales, `/collections/${item.slug}`, item.updated_at),
    ),
    ...(blog_posts.length > 0 ? entry(locales, "/blog") : []),
    ...blog_posts.flatMap((post) => entry(locales, `/blog/${post.slug}`, post.updated_at)),
    ...tags.flatMap((tag) => entry(locales, `/blog/tags/${encodeURIComponent(tag)}`)),
  ];
}
