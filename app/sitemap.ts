import type { MetadataRoute } from "next";

import { getProductSlugs, getStoreCategories } from "@/app/actions/storefront";
import { LOCALES } from "@/i18nConfig";
import { SITE_URL } from "@/lib/site-config";

// Refreshed hourly; product and category pages for every locale, with hreflang alternates.
export const revalidate = 3600;

function entry(path: string, last_modified?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]));
  return LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    lastModified: last_modified ? new Date(last_modified) : undefined,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProductSlugs(), getStoreCategories()]);
  return [
    ...entry(""),
    ...entry("/shop"),
    ...entry("/about"),
    ...entry("/contact"),
    ...entry("/privacy"),
    ...entry("/terms"),
    ...(categories.ok ? categories.data : []).flatMap((category) => entry(`/shop?category=${category.slug}`)),
    ...(products.ok ? products.data : []).flatMap((product) => entry(`/shop/${product.slug}`, product.updated_at)),
  ];
}
