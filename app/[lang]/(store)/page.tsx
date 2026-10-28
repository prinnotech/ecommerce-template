import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getFeaturedProducts, getNewArrivals, getStoreCategories } from "@/app/actions/storefront";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SectionHeading } from "@/components/storefront/section-heading";
import { trustBadges, TrustBadges } from "@/components/storefront/trust-badges";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18nConfig";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";
import { getSiteSettings } from "@/lib/site-settings-server";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const settings = await getSiteSettings();
  return buildPageMetadata({ lang, path: "", description: localized(settings.SITE_DESCRIPTION, lang as Locale) });
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const locale = lang as Locale;
  const [dictionary, settings, featured, new_arrivals, categories] = await Promise.all([
    getDictionary(lang),
    getSiteSettings(),
    getFeaturedProducts(8),
    getNewArrivals(8),
    getStoreCategories(),
  ]);
  const text = dictionary.store;
  const hero_title = localized(settings.HERO_TITLE, locale);
  const hero_subtitle = localized(settings.HERO_SUBTITLE, locale);
  const top_categories = (categories.ok ? categories.data : []).filter((category) => !category.parent).slice(0, 4);
  const featured_products = featured.ok ? featured.data : [];
  const latest_products = new_arrivals.ok ? new_arrivals.data : [];

  // On a photo the buttons invert (light on dark overlay); on the text banner they use the normal theme.
  const heroActions = (is_on_image: boolean) => (
    <div className="flex flex-wrap justify-center gap-3">
      <Button
        asChild
        size="lg"
        className={cn(
          "h-12 px-8 text-base",
          is_on_image && "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
        )}
      >
        <Link href={`/${lang}/shop`}>{text.hero.cta}</Link>
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className="h-12 border-current bg-transparent px-8 text-base hover:bg-current/10"
      >
        <Link href={`/${lang}/shop?sort=newest`}>{text.hero.secondary_cta}</Link>
      </Button>
    </div>
  );

  return (
    <>
      {settings.HERO_IMAGE_URL ? (
        <section className="relative flex min-h-[70svh] items-end overflow-hidden">
          <Image
            src={settings.HERO_IMAGE_URL}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          {/* Primary-tinted overlay keeps the text readable in light and dark themes. */}
          <div className="from-primary/70 via-primary/20 absolute inset-0 bg-gradient-to-t to-transparent" />
          <div className="text-primary-foreground relative mx-auto flex w-full max-w-7xl flex-col items-center gap-5 px-4 py-16 text-center sm:py-24">
            <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
              {hero_title}
            </h1>
            {hero_subtitle && <p className="max-w-xl text-base text-balance opacity-90 sm:text-lg">{hero_subtitle}</p>}
            {heroActions(true)}
          </div>
        </section>
      ) : (
        <section className="bg-muted/50 border-b">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
            <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
              {hero_title}
            </h1>
            {hero_subtitle && (
              <p className="text-muted-foreground max-w-xl text-base text-balance sm:text-lg">{hero_subtitle}</p>
            )}
            {heroActions(false)}
          </div>
        </section>
      )}

      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <TrustBadges badges={trustBadges(settings, text.trust, lang)} />
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-20 px-4 py-16 sm:py-20">
        {top_categories.length > 0 && (
          <section className="flex flex-col gap-8">
            <SectionHeading title={text.home.categories_title} />
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {top_categories.map((category) => {
                const name = localized(category.name, locale);
                return (
                  <li key={category.id}>
                    <Link
                      href={`/${lang}/shop?category=${category.slug}`}
                      className="group bg-muted relative flex aspect-[4/5] items-end overflow-hidden rounded-lg"
                    >
                      {category.image_url ? (
                        <>
                          <Image
                            src={category.image_url}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 25vw, 50vw"
                            className="object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                          <div className="from-primary/60 absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent" />
                        </>
                      ) : (
                        // No photo: a clean tile with dark text instead of a dark overlay on grey.
                        <div className="from-secondary to-muted group-hover:from-muted absolute inset-0 bg-gradient-to-br transition-colors" />
                      )}
                      <span
                        className={cn(
                          "font-display relative flex w-full items-center justify-between p-5 text-xl font-medium sm:text-2xl",
                          category.image_url ? "text-primary-foreground" : "text-foreground",
                        )}
                      >
                        {name}
                        <ArrowRightIcon
                          className="size-5 transition-transform group-hover:translate-x-1"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {featured_products.length > 0 && (
          <section className="flex flex-col gap-8">
            <SectionHeading
              title={text.home.featured_title}
              link={{ href: `/${lang}/shop`, label: text.home.view_all }}
            />
            <ProductGrid
              products={featured_products}
              lang={lang}
              currency={settings.CURRENCY}
              dictionary={text.card}
              priority_count={2}
            />
          </section>
        )}

        {latest_products.length > 0 ? (
          <section className="flex flex-col gap-8">
            <SectionHeading
              title={text.home.new_arrivals_title}
              link={{ href: `/${lang}/shop?sort=newest`, label: text.home.view_all }}
            />
            <ProductGrid products={latest_products} lang={lang} currency={settings.CURRENCY} dictionary={text.card} />
          </section>
        ) : (
          <p className="text-muted-foreground py-10 text-center">{text.home.empty}</p>
        )}
      </div>
    </>
  );
}
