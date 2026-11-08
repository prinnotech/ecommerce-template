import type { StoreCategory, StoreProductCard } from "@repo/core/actions/storefront";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf, ThemeSettings } from "@repo/core/lib/schemas/theme";

type ProductGridSectionProps = {
  section: SectionOf<"product_grid"> | SectionOf<"related_products">;
  products: StoreProductCard[];
  categories: StoreCategory[];
  lang: string;
  currency: string;
  card_style: ThemeSettings["product_card"];
  dictionary: Dictionary["store"];
  is_first_grid: boolean;
};

// Where "View all" goes: the same products on the shop page.
function viewAllHref(section: SectionOf<"product_grid">, categories: StoreCategory[], lang: string): string {
  const { source, category_id } = section.settings;
  if (source === "newest") return `/${lang}/shop?sort=newest`;
  const category = source === "category" ? categories.find((item) => item.id === category_id) : undefined;
  return category ? `/${lang}/shop?category=${category.slug}` : `/${lang}/shop`;
}

export function ProductGridSection({
  section,
  products,
  categories,
  lang,
  currency,
  card_style,
  dictionary,
  is_first_grid,
}: ProductGridSectionProps) {
  if (products.length === 0) return null;
  const heading = localized(section.settings.heading, lang as Locale);
  const view_all =
    section.type === "product_grid" && section.settings.show_view_all
      ? { href: viewAllHref(section, categories, lang), label: dictionary.home.view_all }
      : undefined;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:py-14">
      {(heading || view_all) && <SectionHeading title={heading} link={view_all} />}
      <ProductGrid
        products={products}
        lang={lang}
        currency={currency}
        dictionary={dictionary.card}
        card_style={card_style}
        priority_count={is_first_grid ? 2 : 0}
      />
    </section>
  );
}
