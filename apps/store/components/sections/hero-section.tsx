import Image from "next/image";
import Link from "next/link";

import { sectionButton } from "./section-link";
import { Button } from "@repo/ui/components/ui/button";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

type HeroSectionProps = { section: SectionOf<"hero">; lang: string; is_first: boolean };

export function HeroSection({ section, lang, is_first }: HeroSectionProps) {
  const { settings } = section;
  const locale = lang as Locale;
  const heading = localized(settings.heading, locale);
  const subtitle = localized(settings.subtitle, locale);
  const primary = sectionButton(settings.primary_button, lang);
  const secondary = sectionButton(settings.secondary_button, lang);
  const is_left = settings.alignment === "left";
  const is_large = settings.size === "large";
  const has_image = Boolean(settings.image_url);
  const heading_class =
    "font-display max-w-3xl text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl";

  const content = (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4",
        is_left ? "items-start text-left" : "items-center text-center",
        has_image ? (is_large ? "py-16 sm:py-24" : "py-12 sm:py-16") : is_large ? "py-20 sm:py-28" : "py-14 sm:py-20",
      )}
    >
      {/* The first section's heading is the page's h1. */}
      {heading &&
        (is_first ? <h1 className={heading_class}>{heading}</h1> : <h2 className={heading_class}>{heading}</h2>)}
      {subtitle && (
        <p
          className={cn(
            "max-w-xl text-base text-balance sm:text-lg",
            has_image ? "opacity-90" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      )}
      {(primary || secondary) && (
        <div className={cn("flex flex-wrap gap-3", !is_left && "justify-center")}>
          {primary && (
            <Button
              asChild
              size="lg"
              // On a photo the button inverts (light on the dark overlay) and keeps its fill in every theme.
              data-on-image={has_image || undefined}
              className={cn(
                "h-12 px-8 text-base",
                has_image && "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
              )}
            >
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
          )}
          {secondary && (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-current bg-transparent px-8 text-base hover:bg-current/10"
            >
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (!has_image) {
    return <section className="bg-muted/50 border-b">{content}</section>;
  }
  return (
    <section className={cn("relative flex items-end overflow-hidden", is_large ? "min-h-[70svh]" : "min-h-[50svh]")}>
      <Image
        src={settings.image_url}
        alt=""
        fill
        priority={is_first}
        unoptimized
        sizes="100vw"
        className="object-cover"
      />
      {/* Primary-tinted overlay keeps the text readable in light and dark themes. */}
      <div className="from-primary/70 via-primary/20 absolute inset-0 bg-gradient-to-t to-transparent" />
      <div className="text-primary-foreground relative w-full">{content}</div>
    </section>
  );
}
