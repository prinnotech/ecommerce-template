import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStoreProduct } from "@repo/core/actions/storefront";
import { ThemeSections } from "@/components/sections/theme-sections";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { localized } from "@repo/core/lib/localized";
import { getLiveTheme } from "@repo/core/lib/theme-server";
// No pages at build time; each product is rendered on its first visit, then cached and
// refreshed by revalidation (layout revalidate + revalidatePath on product changes).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/shop/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const product = await getStoreProduct(slug);
  if (!product.ok) return { robots: { index: false } };
  const locale = lang as Locale;
  // The product's own search listing first (Search engine listing card), then its title and text.
  const description = (localized(product.data.seo.description, locale) || localized(product.data.description, locale))
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const metadata = await buildPageMetadata({
    lang,
    path: `/shop/${slug}`,
    title: localized(product.data.seo.title, locale) || localized(product.data.title, locale),
    description,
  });
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: product.data.images.slice(0, 1) },
  };
}

// The product block is a fixed section of the theme's product page; the theme decides what comes
// above and below it.
export default async function ProductPage({ params }: PageProps<"/[lang]/shop/[slug]">) {
  const { lang, slug } = await params;
  const [product, theme] = await Promise.all([getStoreProduct(slug), getLiveTheme()]);
  if (!product.ok) notFound();

  return (
    <div className="pb-6">
      <ThemeSections
        sections={theme.pages.product}
        theme={theme.settings}
        lang={lang}
        product={product.data}
        fallback_title={localized(product.data.title, lang as Locale)}
      />
    </div>
  );
}
