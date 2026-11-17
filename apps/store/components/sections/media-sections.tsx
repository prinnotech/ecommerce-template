import { ArrowRightIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { sectionButton } from "./section-link";
import { Slideshow } from "./slideshow";
import type { StoreCollectionTile } from "@repo/core/actions/storefront";
import { SectionHeading } from "@/components/storefront/section-heading";
import { Button } from "@repo/ui/components/ui/button";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

// Store rendering of the sections added with theme editor v2.

const GRID_COLUMNS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

type SectionText = Dictionary["store"]["sections"];

export function SlideshowSection({
  section,
  lang,
  is_first,
  text,
}: {
  section: SectionOf<"slideshow">;
  lang: string;
  is_first: boolean;
  text: SectionText;
}) {
  const locale = lang as Locale;
  const { settings } = section;
  return (
    <Slideshow
      slides={settings.slides.map((slide) => ({
        id: slide.id,
        image_url: slide.image_url,
        heading: localized(slide.heading, locale),
        subtitle: localized(slide.subtitle, locale),
        button: sectionButton(slide.button, lang),
      }))}
      autoplay_seconds={settings.autoplay_seconds}
      height={settings.height}
      alignment={settings.alignment}
      is_first={is_first}
      labels={{ previous: text.previous_slide, next: text.next_slide, go_to: text.go_to_slide }}
    />
  );
}

const MARQUEE_SECONDS = { slow: 60, medium: 40, fast: 22 } as const;

export function MarqueeSection({ section, lang }: { section: SectionOf<"marquee">; lang: string }) {
  const locale = lang as Locale;
  const items = section.settings.items.map((item) => localized(item.text, locale)).filter(Boolean);
  if (items.length === 0) return null;
  const is_large = section.settings.size === "large";
  const list = (is_copy: boolean) => (
    <ul aria-hidden={is_copy || undefined} className="flex shrink-0 items-center">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="flex items-center">
          <span className="px-6 whitespace-nowrap">{item}</span>
          <span className="opacity-40" aria-hidden>
            ✦
          </span>
        </li>
      ))}
    </ul>
  );
  // The duration is computed from the speed setting (a computed value, hence the inline style).
  const style = { "--marquee-duration": `${MARQUEE_SECONDS[section.settings.speed]}s` } as CSSProperties;
  return (
    <section className={cn("overflow-hidden border-y", is_large ? "py-6" : "py-3")}>
      <div
        style={style}
        className={cn(
          "animate-marquee flex w-max motion-reduce:animate-none",
          is_large ? "font-display text-3xl tracking-tight sm:text-4xl" : "text-sm font-medium tracking-wide",
        )}
      >
        {list(false)}
        {list(true)}
      </div>
    </section>
  );
}

export function CollectionListSection({
  section,
  collections,
  lang,
}: {
  section: SectionOf<"collection_list">;
  collections: StoreCollectionTile[];
  lang: string;
}) {
  const locale = lang as Locale;
  const tiles = section.settings.collection_ids
    .map((id) => collections.find((collection) => collection.id === id))
    .filter((collection) => collection !== undefined);
  if (tiles.length === 0) return null;
  const heading = localized(section.settings.heading, locale);
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:py-14">
      {heading && <SectionHeading title={heading} />}
      <ul className={cn("grid grid-cols-1 gap-4", GRID_COLUMNS[section.settings.columns])}>
        {tiles.map((collection) => (
          <li key={collection.id}>
            <Link href={`/${lang}/collections/${collection.slug}`} className="group flex flex-col gap-3">
              <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
                {collection.image_url && (
                  <Image
                    src={collection.image_url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <span className="font-display flex items-center gap-2 text-lg font-medium">
                {localized(collection.title, locale)}
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MulticolumnSection({ section, lang }: { section: SectionOf<"multicolumn">; lang: string }) {
  const locale = lang as Locale;
  const { settings } = section;
  const heading = localized(settings.heading, locale);
  const is_center = settings.alignment === "center";
  if (settings.items.length === 0 && !heading) return null;
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:py-16">
      {heading && (
        <h2 className={cn("font-display text-2xl font-medium tracking-tight sm:text-3xl", is_center && "text-center")}>
          {heading}
        </h2>
      )}
      <ul className={cn("grid grid-cols-1 gap-10", GRID_COLUMNS[settings.columns])}>
        {settings.items.map((item) => {
          const title = localized(item.heading, locale);
          const body = localized(item.body, locale);
          const button = sectionButton(item.button, lang);
          return (
            <li
              key={item.id}
              className={cn("flex flex-col gap-3", is_center ? "items-center text-center" : "items-start")}
            >
              {item.image_url && (
                <div className="bg-muted relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg">
                  <Image
                    src={item.image_url}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              {title && <h3 className="text-lg font-medium">{title}</h3>}
              {body && <p className="text-muted-foreground text-sm leading-relaxed text-pretty">{body}</p>}
              {button && (
                <Link
                  href={button.href}
                  className="group flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  {button.label}
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const BANNER_HEIGHTS = { small: "min-h-[35svh]", medium: "min-h-[50svh]", large: "min-h-[70svh]" } as const;

export function ImageBannerSection({
  section,
  lang,
  is_first,
}: {
  section: SectionOf<"image_banner">;
  lang: string;
  is_first: boolean;
}) {
  const locale = lang as Locale;
  const { settings } = section;
  const heading = localized(settings.heading, locale);
  const body = localized(settings.body, locale);
  const button = sectionButton(settings.button, lang);
  const has_image = Boolean(settings.image_url);
  const is_left = settings.alignment === "left";
  const heading_class = "font-display max-w-3xl text-4xl font-medium tracking-tight text-balance sm:text-5xl";
  return (
    <section
      className={cn(
        "relative flex items-center overflow-hidden",
        BANNER_HEIGHTS[settings.height],
        !has_image && "bg-muted/50",
      )}
    >
      {has_image && (
        <>
          <Image
            src={settings.image_url}
            alt=""
            fill
            priority={is_first}
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          {/* Tinted with the theme's primary colour, like the hero; the strength is the owner's
              setting (a computed value). */}
          <div className="bg-primary absolute inset-0" style={{ opacity: settings.overlay / 100 }} />
        </>
      )}
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-14",
          is_left ? "items-start text-left" : "items-center text-center",
          has_image && "text-primary-foreground",
        )}
      >
        {heading &&
          (is_first ? <h1 className={heading_class}>{heading}</h1> : <h2 className={heading_class}>{heading}</h2>)}
        {body && (
          <p className={cn("max-w-xl text-balance sm:text-lg", !has_image && "text-muted-foreground")}>{body}</p>
        )}
        {button && (
          <Button
            asChild
            size="lg"
            data-on-image={has_image || undefined}
            className={cn(
              "mt-2 h-12 px-8 text-base",
              has_image && "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
            )}
          >
            <Link href={button.href}>{button.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

export function TestimonialsSection({
  section,
  lang,
  text,
}: {
  section: SectionOf<"testimonials">;
  lang: string;
  text: SectionText;
}) {
  const locale = lang as Locale;
  const items = section.settings.items
    .map((item) => ({ ...item, quote: localized(item.quote, locale) }))
    .filter((item) => item.quote);
  if (items.length === 0) return null;
  const heading = localized(section.settings.heading, locale);
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:py-16">
      {heading && (
        <h2 className="font-display text-center text-2xl font-medium tracking-tight sm:text-3xl">{heading}</h2>
      )}
      <ul className={cn("grid grid-cols-1 gap-6", GRID_COLUMNS[items.length >= 3 ? 3 : 2])}>
        {items.map((item) => (
          <li key={item.id} className="bg-card flex flex-col gap-4 rounded-lg border p-6">
            {item.rating > 0 && (
              <div
                className="flex gap-0.5"
                role="img"
                aria-label={text.rating.replace("{rating}", String(item.rating))}
              >
                {Array.from({ length: 5 }, (_, star) => (
                  <StarIcon
                    key={star}
                    className={cn("size-4", star < item.rating ? "fill-current" : "opacity-25")}
                    aria-hidden
                  />
                ))}
              </div>
            )}
            <blockquote className="text-pretty">“{item.quote}”</blockquote>
            {item.author && <p className="text-muted-foreground mt-auto text-sm font-medium">{item.author}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
