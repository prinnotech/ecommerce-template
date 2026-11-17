import { Fragment, type ReactNode } from "react";

import { CategoryTilesSection } from "./category-tiles-section";
import {
  ContactFormSection,
  FaqSection,
  GallerySection,
  PageHeaderSection,
  SpacerSection,
  VideoSection,
} from "./content-sections";
import { HeroSection } from "./hero-section";
import {
  CollectionListSection,
  ImageBannerSection,
  MarqueeSection,
  MulticolumnSection,
  SlideshowSection,
  TestimonialsSection,
} from "./media-sections";
import { ImageWithTextSection } from "./image-with-text-section";
import { NewsletterSection } from "./newsletter-section";
import { ProductGridSection } from "./product-grid-section";
import { ProductMainSection } from "./product-main-section";
import { RichTextSection } from "./rich-text-section";
import {
  getCategoryProducts,
  getCollectionProducts,
  getFeaturedProducts,
  getNewArrivals,
  getRelatedProducts,
  getStoreCategories,
  getStoreCollectionTiles,
  type StoreProduct,
  type StoreProductCard,
} from "@repo/core/actions/storefront";
import { trustBadges, TrustBadges } from "@/components/storefront/trust-badges";
import type { ActionResult } from "@repo/core/lib/action-result";
import { getDictionary } from "@repo/core/lib/i18n";
import type { ThemeSection, ThemeSettings } from "@repo/core/lib/schemas/theme";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { colorSchemeClass } from "@repo/core/themes/css";
import { PREVIEW_SECTION_ATTRIBUTE } from "@repo/core/themes/preview";

type ProductSource = Extract<ThemeSection, { type: "product_grid" | "related_products" }>;

function productsFor(section: ProductSource, product?: StoreProduct): Promise<ActionResult<StoreProductCard[]>> {
  if (section.type === "related_products") {
    if (!product) return Promise.resolve({ ok: true, data: [] });
    return getRelatedProducts(product.id, product.category?.id ?? "", section.settings.limit);
  }
  const { source, limit, category_id, collection_id } = section.settings;
  if (source === "newest") return getNewArrivals(limit);
  if (source === "category") return getCategoryProducts(category_id, limit);
  if (source === "collection") return getCollectionProducts(collection_id, limit);
  return getFeaturedProducts(limit);
}

// The first section that is the page's own h1 (a hero, slideshow or banner on top, a page title or
// the product).
function hasHeading(sections: ThemeSection[]): boolean {
  const first = sections[0]?.type;
  return (
    first === "hero" ||
    first === "slideshow" ||
    first === "image_banner" ||
    sections.some(
      (section) => section.type === "page_header" || section.type === "product_main" || section.type === "product_list",
    )
  );
}

type ThemeSectionsProps = {
  sections: ThemeSection[];
  theme: ThemeSettings;
  lang: string;
  // The product page's product (product_main and related_products need it).
  product?: StoreProduct;
  // The page's h1 when no section provides one (screen readers and search engines).
  fallback_title: string;
  // Home only: a line when the store has no products yet.
  empty_text?: string;
  // The theme editor's preview: each section is marked so it can be hovered and selected.
  is_preview?: boolean;
  // The collection template's product list (Shop, a category or a collection page), rendered in
  // place of its "product_list" section.
  listing?: ReactNode;
};

// A page as the theme describes it: its visible sections, in order. Product lists for every
// section are read in parallel up front.
export async function ThemeSections({
  sections,
  theme,
  lang,
  product,
  fallback_title,
  empty_text,
  is_preview = false,
  listing,
}: ThemeSectionsProps) {
  const visible = sections.filter((section) => !section.is_hidden);
  // The product list has the page's h1, so a hero above it uses h2.
  const has_listing = visible.some((section) => section.type === "product_list");
  const lists = visible.filter(
    (section): section is ProductSource => section.type === "product_grid" || section.type === "related_products",
  );
  const collection_ids = visible.flatMap((section) =>
    section.type === "collection_list" ? section.settings.collection_ids : [],
  );
  const [dictionary, settings, categories, collection_tiles, ...list_results] = await Promise.all([
    getDictionary(lang),
    getSiteSettings(),
    getStoreCategories(),
    collection_ids.length > 0 ? getStoreCollectionTiles(collection_ids) : null,
    ...lists.map((section) => productsFor(section, product)),
  ]);
  const collections = collection_tiles?.ok ? collection_tiles.data : [];
  const products = new Map(
    lists.map((section, index) => {
      const result = list_results[index];
      return [section.id, result?.ok ? result.data : []];
    }),
  );
  const category_list = categories.ok ? categories.data : [];
  const first_list_id = lists.find((section) => (products.get(section.id) ?? []).length > 0)?.id;
  const grids = lists.filter((section) => section.type === "product_grid");
  const has_no_products = Boolean(empty_text) && grids.length > 0 && first_list_id === undefined;

  return (
    <>
      {!hasHeading(visible) && <h1 className="sr-only">{fallback_title}</h1>}
      {visible.map((section, index) => {
        const node = renderSection(section, index);
        const scheme_class = colorSchemeClass(section.color_scheme);
        if (!is_preview && !scheme_class) return node;
        return (
          <div
            key={section.id}
            className={scheme_class || undefined}
            {...(is_preview ? { [PREVIEW_SECTION_ATTRIBUTE]: section.id } : {})}
          >
            {node}
          </div>
        );
      })}
      {has_no_products && <p className="text-muted-foreground px-4 py-16 text-center">{empty_text}</p>}
    </>
  );

  function renderSection(section: ThemeSection, index: number) {
    switch (section.type) {
      case "hero":
        return <HeroSection key={section.id} section={section} lang={lang} is_first={index === 0 && !has_listing} />;
      case "trust_badges":
        return (
          <section key={section.id} className="border-b">
            <div className="mx-auto max-w-7xl px-4 py-8">
              <TrustBadges badges={trustBadges(settings, dictionary.store.trust, lang)} />
            </div>
          </section>
        );
      case "category_tiles":
        return <CategoryTilesSection key={section.id} section={section} categories={category_list} lang={lang} />;
      case "product_grid":
      case "related_products":
        return (
          <ProductGridSection
            key={section.id}
            section={section}
            products={products.get(section.id) ?? []}
            categories={category_list}
            lang={lang}
            currency={settings.CURRENCY}
            card_style={theme.product_card}
            dictionary={dictionary.store}
            is_first_grid={section.id === first_list_id}
          />
        );
      case "image_with_text":
        return <ImageWithTextSection key={section.id} section={section} lang={lang} />;
      case "rich_text":
        return <RichTextSection key={section.id} section={section} lang={lang} />;
      case "newsletter":
        return <NewsletterSection key={section.id} section={section} lang={lang} dictionary={dictionary} />;
      case "faq":
        return <FaqSection key={section.id} section={section} lang={lang} />;
      case "gallery":
        return <GallerySection key={section.id} section={section} lang={lang} />;
      case "video":
        return (
          <VideoSection
            key={section.id}
            section={section}
            lang={lang}
            fallback_title={dictionary.store.sections.video}
          />
        );
      case "spacer":
        return <SpacerSection key={section.id} section={section} />;
      case "page_header":
        return <PageHeaderSection key={section.id} section={section} lang={lang} />;
      case "contact_form":
        return (
          <ContactFormSection
            key={section.id}
            section={section}
            lang={lang}
            settings={settings}
            dictionary={dictionary}
          />
        );
      case "slideshow":
        return (
          <SlideshowSection
            key={section.id}
            section={section}
            lang={lang}
            is_first={index === 0 && !has_listing}
            text={dictionary.store.sections}
          />
        );
      case "marquee":
        return <MarqueeSection key={section.id} section={section} lang={lang} />;
      case "collection_list":
        return <CollectionListSection key={section.id} section={section} collections={collections} lang={lang} />;
      case "multicolumn":
        return <MulticolumnSection key={section.id} section={section} lang={lang} />;
      case "image_banner":
        return (
          <ImageBannerSection key={section.id} section={section} lang={lang} is_first={index === 0 && !has_listing} />
        );
      case "testimonials":
        return <TestimonialsSection key={section.id} section={section} lang={lang} text={dictionary.store.sections} />;
      case "product_list":
        return listing ? <Fragment key={section.id}>{listing}</Fragment> : null;
      case "product_main":
        return product ? (
          <ProductMainSection
            key={section.id}
            section={section}
            product={product}
            lang={lang}
            settings={settings}
            dictionary={dictionary}
          />
        ) : null;
    }
  }
}
