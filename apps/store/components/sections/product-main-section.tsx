import { BanknoteIcon, ChevronDownIcon, RotateCcwIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import Link from "next/link";

import { getProductReviews } from "@repo/core/actions/reviews";
import type { StoreProduct } from "@repo/core/actions/storefront";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchase } from "@/components/storefront/product-purchase";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { StarRating } from "@/components/storefront/star-rating";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { hasCashOnDelivery } from "@repo/core/lib/payment-methods";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { SITE_URL } from "@repo/core/lib/site-config";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { formatCurrency, formatNumber, formatPlural } from "@repo/core/lib/utils/format";

type ProductMainSectionProps = {
  section: SectionOf<"product_main">;
  product: StoreProduct;
  lang: string;
  settings: SiteSettings;
  dictionary: Dictionary;
};

// The product page's fixed block: breadcrumb, photos, price, sizes, add to cart, details and
// reviews. Themes place sections above and below it.
export async function ProductMainSection({ section, product, lang, settings, dictionary }: ProductMainSectionProps) {
  const locale = lang as Locale;
  const text = dictionary.store.product;
  const title = localized(product.title, locale);
  const description = localized(product.description, locale);
  const currency = settings.CURRENCY;
  const rates = settings.SHIPPING_RATES;
  const min_days = String(Math.min(...rates.map((rate) => rate.min_days)));
  const max_days = String(Math.max(...rates.map((rate) => rate.max_days)));
  const money = (cents: number) => formatCurrency(cents, currency, lang);
  // A failed read hides the reviews instead of breaking the product page.
  const reviews = await getProductReviews({ product_id: product.id });
  const summary = reviews.ok ? reviews.data.summary : { average: 0, count: 0 };
  const average = formatNumber(summary.average, lang, { maximumFractionDigits: 1 });

  const assurances = [
    { Icon: TruckIcon, label: text.delivery.replace("{min}", min_days).replace("{max}", max_days) },
    settings.FREE_SHIPPING_THRESHOLD > 0
      ? { Icon: TruckIcon, label: text.free_shipping.replace("{amount}", money(settings.FREE_SHIPPING_THRESHOLD)) }
      : null,
    settings.RETURNS_DAYS > 0
      ? { Icon: RotateCcwIcon, label: text.returns.replace("{days}", String(settings.RETURNS_DAYS)) }
      : null,
    hasCashOnDelivery(settings) ? { Icon: BanknoteIcon, label: text.cod } : null,
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
    ...(summary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: summary.average.toFixed(1),
            reviewCount: summary.count,
          },
        }
      : {}),
  };

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pt-4 pb-10 lg:pt-8">
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
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-display text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
                    {title}
                  </h1>
                  <WishlistButton product_id={product.id} dictionary={dictionary.store.wishlist} variant="inline" />
                </div>
                {summary.count > 0 && (
                  <a
                    href="#reviews"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
                  >
                    <StarRating
                      rating={summary.average}
                      label={dictionary.store.reviews.average.replace("{average}", average)}
                    />
                    {formatPlural(summary.count, dictionary.store.reviews.count, lang)}
                  </a>
                )}
              </div>

              <ProductPurchase
                lang={lang}
                product_id={product.id}
                title={title}
                variants={product.variants}
                compare_at_price={product.compare_at_price}
                currency={currency}
                dictionary={text}
              />

              {section.settings.show_assurances && (
                <ul className="bg-muted/40 flex flex-col gap-3 rounded-lg p-4 text-sm">
                  {assurances.map(({ Icon, label }) => (
                    <li key={label} className="flex items-center gap-3">
                      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
              )}

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
      </section>
      {reviews.ok && (
        <ProductReviews
          product_id={product.id}
          lang={lang}
          first_page={reviews.data}
          dictionary={dictionary.store.reviews}
          common={dictionary.common}
          errors={dictionary.errors}
          validation={dictionary.validation}
        />
      )}
    </>
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
