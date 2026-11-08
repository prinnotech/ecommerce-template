import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/storefront/product-grid";
import { getStoreCollection } from "@repo/core/actions/storefront";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { getLiveTheme } from "@repo/core/lib/theme-server";
import { formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";

// Rendered on the first visit, then cached; editing a collection in the admin refreshes the store.
export function generateStaticParams() {
  return [];
}

function pageOf(value: string | string[] | undefined): number {
  const number = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(number) && number > 1 ? number : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[lang]/collections/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = pageOf((await searchParams).page);
  const result = await getStoreCollection(slug, 1);
  if (!result.ok) return { robots: { index: false } };
  const locale = lang as Locale;
  const { collection } = result.data;
  const metadata = await buildPageMetadata({
    lang,
    path: `/collections/${slug}`,
    title: localized(collection.seo.title, locale) || localized(collection.title, locale),
    description:
      localized(collection.seo.description, locale) || localized(collection.description, locale).slice(0, 160),
  });
  // Later pages point search engines at the first one.
  return page > 1 ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/[lang]/collections/[slug]">) {
  const { lang, slug } = await params;
  const page = pageOf((await searchParams).page);
  const [result, dictionary, currency, theme] = await Promise.all([
    getStoreCollection(slug, page),
    getDictionary(lang),
    getSiteSetting("CURRENCY"),
    getLiveTheme(),
  ]);
  if (!result.ok) notFound();
  const locale = lang as Locale;
  const { collection, products } = result.data;
  const text = dictionary.store.collection;
  const title = localized(collection.title, locale) || collection.slug;
  const description = localized(collection.description, locale);
  const href = (target: number) => `/${lang}/collections/${slug}${target > 1 ? `?page=${target}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 lg:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-end">
        {collection.image_url && (
          <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden rounded-lg md:w-80">
            <Image
              src={collection.image_url}
              alt=""
              fill
              sizes="(min-width: 768px) 20rem, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{title}</h1>
          {description && (
            <div className="text-muted-foreground flex flex-col gap-2 leading-relaxed">
              {description.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          )}
          <p className="text-muted-foreground text-sm">{formatPlural(products.total_items, text.products, lang)}</p>
        </div>
      </header>

      {products.items.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center">{text.empty}</p>
      ) : (
        <ProductGrid
          products={products.items}
          lang={lang}
          currency={currency}
          dictionary={dictionary.store.card}
          priority_count={4}
          card_style={theme.settings.product_card}
        />
      )}

      {products.total_pages > 1 && (
        <nav
          className="flex items-center justify-center gap-3"
          aria-label={text.page
            .replace("{page}", String(products.page))
            .replace("{total}", String(products.total_pages))}
        >
          {products.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={href(products.page - 1)}>{text.previous}</Link>
            </Button>
          ) : null}
          <span className="text-muted-foreground text-sm">
            {text.page.replace("{page}", String(products.page)).replace("{total}", String(products.total_pages))}
          </span>
          {products.page < products.total_pages ? (
            <Button asChild variant="outline">
              <Link href={href(products.page + 1)}>{text.next}</Link>
            </Button>
          ) : null}
        </nav>
      )}
    </div>
  );
}
