import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreviewBridge } from "./components/preview-bridge";
import { getNewArrivals, getProductSlugs, getStoreProduct, type StoreProduct } from "@repo/core/actions/storefront";
import { ThemeSections } from "@/components/sections/theme-sections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ThemeStyle } from "@/components/theme-style";
import { getDictionary } from "@repo/core/lib/i18n";
import { THEME_PAGES, type ThemePage } from "@repo/core/lib/schemas/theme";
import { ADMIN_URL } from "@repo/core/lib/site-config";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { getPreviewPageSections, getPreviewTheme } from "@repo/core/lib/theme-server";

// The theme editor's live preview: a theme's draft, inside the admin's iframe. Only a valid,
// unexpired token (signed by the admin with THEME_PREVIEW_SECRET) shows a draft; it lives outside
// the store layouts, so the live theme's styles don't mix in. ?page= picks the page template.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function previewPage(value: unknown): ThemePage {
  return THEME_PAGES.find((page) => page === value) ?? "home";
}

// The product page needs a product: the newest one in the store.
async function sampleProduct(): Promise<StoreProduct | undefined> {
  const slugs = await getProductSlugs();
  const slug = slugs.ok ? slugs.data[0]?.slug : undefined;
  if (!slug) return undefined;
  const product = await getStoreProduct(slug);
  return product.ok ? product.data : undefined;
}

export default async function ThemePreviewPage({ params, searchParams }: PageProps<"/[lang]/theme-preview/[token]">) {
  const { lang, token } = await params;
  const page_param = (await searchParams).page;
  const page = previewPage(page_param);
  // "page:<id>": a custom page from Online store → Pages, shown in the draft theme's look.
  const custom_id = typeof page_param === "string" && page_param.startsWith("page:") ? page_param.slice(5) : null;
  const data = await getPreviewTheme(decodeURIComponent(token));
  if (!data) notFound();
  const custom_sections = custom_id ? await getPreviewPageSections(decodeURIComponent(token), custom_id) : null;
  const [dictionary, settings, product, newest] = await Promise.all([
    getDictionary(lang),
    getSiteSettings(),
    page === "product" ? sampleProduct() : undefined,
    page === "collection" ? getNewArrivals(8) : undefined,
  ]);
  const titles: Record<ThemePage, string> = {
    home: settings.SITE_NAME,
    product: settings.SITE_NAME,
    collection: dictionary.store.shop.title,
    about: dictionary.pages.about.title,
    contact: dictionary.contact.title,
  };

  // The collection template's product list, as the Shop page shows it (without filters, which
  // need the real page's address).
  const list = data.pages.collection.find((section) => section.type === "product_list");
  const listing = newest?.ok ? (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-medium tracking-tight sm:text-5xl">{dictionary.store.shop.title}</h1>
      <ProductGrid
        products={newest.data}
        lang={lang}
        currency={settings.CURRENCY}
        dictionary={dictionary.store.card}
        columns={list?.type === "product_list" ? list.settings.columns : 3}
        card_style={data.settings.product_card}
      />
    </div>
  ) : undefined;

  return (
    <>
      <ThemeStyle settings={data.settings} />
      <SiteHeader lang={lang} header_group={data.header_group} is_preview />
      <main id="main" className="flex-1 pb-6">
        {custom_sections ? (
          <ThemeSections
            sections={custom_sections}
            theme={data.settings}
            lang={lang}
            fallback_title={settings.SITE_NAME}
            is_preview
          />
        ) : page === "product" && !product ? (
          <p className="text-muted-foreground px-4 py-24 text-center">{dictionary.store.home.empty}</p>
        ) : (
          <ThemeSections
            sections={data.pages[page]}
            theme={data.settings}
            lang={lang}
            product={product}
            fallback_title={titles[page]}
            empty_text={page === "home" ? dictionary.store.home.empty : undefined}
            listing={listing}
            is_preview
          />
        )}
      </main>
      <SiteFooter lang={lang} footer_group={data.footer_group} is_preview />
      <PreviewBridge admin_origin={new URL(ADMIN_URL).origin} />
    </>
  );
}
