import { BanknoteIcon, ChevronDownIcon, RotateCcwIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGallery } from "./components/product-gallery";
import { ProductPurchase } from "./components/product-purchase";
import { getRelatedProducts, getStoreProduct } from "@/app/actions/storefront";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { Locale } from "@/i18nConfig";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { SITE_URL } from "@/lib/site-config";
import { getSiteSettings } from "@/lib/site-settings-server";
import { formatCurrency } from "@/lib/utils/format";

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
  const description = localized(product.data.description, locale).replace(/\s+/g, " ").slice(0, 160);
  const metadata = await buildPageMetadata({
    lang,
    path: `/shop/${slug}`,
    title: localized(product.data.title, locale),
    description,
  });
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: product.data.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: PageProps<"/[lang]/shop/[slug]">) {
  const { lang, slug } = await params;
  const locale = lang as Locale;
  const [product_result, dictionary, settings] = await Promise.all([
    getStoreProduct(slug),
    getDictionary(lang),
    getSiteSettings(),
  ]);
  if (!product_result.ok) notFound();

  const product = product_result.data;
  const related = await getRelatedProducts(product.id, product.category?.id ?? "", 4);
  const text = dictionary.store.product;
  const title = localized(product.title, locale);
  const description = localized(product.description, locale);
  const currency = settings.CURRENCY;
  const rates = settings.SHIPPING_RATES;
  const min_days = String(Math.min(...rates.map((rate) => rate.min_days)));
  const max_days = String(Math.max(...rates.map((rate) => rate.max_days)));
  const money = (cents: number) => formatCurrency(cents, currency, lang);

  const assurances = [
    { Icon: TruckIcon, label: text.delivery.replace("{min}", min_days).replace("{max}", max_days) },
    settings.FREE_SHIPPING_THRESHOLD > 0
      ? { Icon: TruckIcon, label: text.free_shipping.replace("{amount}", money(settings.FREE_SHIPPING_THRESHOLD)) }
      : null,
    settings.RETURNS_DAYS > 0
      ? { Icon: RotateCcwIcon, label: text.returns.replace("{days}", String(settings.RETURNS_DAYS)) }
      : null,
    settings.PAYMENT_METHODS.cash_on_delivery ? { Icon: BanknoteIcon, label: text.cod } : null,
    { Icon: ShieldCheckIcon, label: text.secure },
  ].filter((item) => item !== null);

  // Product rich results (price, availability) in search engines.
  const prices = product.variants.map((variant) => variant.price);
  const json_ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    image: product.images,
    url: `${SITE_URL}/${lang}/shop/${product.slug}`,
    ...(product.category ? { category: localized(product.category.name, locale) } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: currency,
      lowPrice: ((prices.length > 0 ? Math.min(...prices) : product.price) / 100).toFixed(2),
      highPrice: ((prices.length > 0 ? Math.max(...prices) : product.price) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.variants.some((variant) => variant.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 pb-16 lg:pt-8">
      <script
        type="application/ld+json"
        // JSON from our own data; "<" is escaped so it can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(json_ld).replace(/</g, "\\u003c") }}
      />

      <nav aria-label={text.breadcrumb} className="text-muted-foreground mb-4 text-sm lg:mb-6">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={`/${lang}`} className="hover:text-foreground">
              {text.home}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/${lang}/shop`} className="hover:text-foreground">
              {text.shop}
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/${lang}/shop?category=${product.category.slug}`} className="hover:text-foreground">
                  {localized(product.category.name, locale)}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden className="hidden sm:block">
            /
          </li>
          <li aria-current="page" className="text-foreground hidden truncate sm:block">
            {title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery
          images={product.images}
          title={title}
          labels={{ gallery: text.gallery, image_alt: text.image_alt }}
        />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              {product.category && (
                <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                  {localized(product.category.name, locale)}
                </p>
              )}
              <h1 className="font-display text-3xl leading-tight font-medium tracking-tight sm:text-4xl">{title}</h1>
            </div>

            <ProductPurchase
              lang={lang}
              title={title}
              variants={product.variants}
              compare_at_price={product.compare_at_price}
              currency={currency}
              dictionary={text}
            />

            <ul className="bg-muted/40 flex flex-col gap-3 rounded-lg p-4 text-sm">
              {assurances.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>

            <div className="divide-y border-y">
              {description && (
                <Disclosure title={text.description} is_open>
                  <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
                    {description.split(/\n\s*\n/).map((paragraph) => (
                      <p key={paragraph.slice(0, 40)} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </Disclosure>
              )}
              <Disclosure title={text.shipping_returns}>
                <div className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
                  <p>{text.shipping_text.replace("{min}", min_days).replace("{max}", max_days)}</p>
                  <p>
                    {settings.RETURNS_DAYS > 0
                      ? text.returns_text.replace("{days}", String(settings.RETURNS_DAYS))
                      : text.no_returns_text}
                  </p>
                </div>
              </Disclosure>
            </div>
          </div>
        </div>
      </div>

      {related.ok && related.data.length > 0 && (
        <section className="mt-20 flex flex-col gap-8">
          <SectionHeading title={text.related} />
          <ProductGrid products={related.data} lang={lang} currency={currency} dictionary={dictionary.store.card} />
        </section>
      )}
    </div>
  );
}

// Native <details>: accessible and works without JavaScript.
function Disclosure({ title, is_open, children }: { title: string; is_open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group py-4" open={is_open}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
