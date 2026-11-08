import Image from "next/image";
import Link from "next/link";

import { sectionButton } from "./section-link";
import { RichText } from "@/components/storefront/rich-text";
import { Button } from "@repo/ui/components/ui/button";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

export function ImageWithTextSection({ section, lang }: { section: SectionOf<"image_with_text">; lang: string }) {
  const { settings } = section;
  const locale = lang as Locale;
  const heading = localized(settings.heading, locale);
  const body = localized(settings.body, locale);
  const button = sectionButton(settings.button, lang);

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:py-14 md:grid-cols-2 md:gap-14">
      <div
        className={cn(
          "bg-muted relative aspect-[4/5] overflow-hidden rounded-lg sm:aspect-[4/3]",
          settings.image_position === "right" && "md:order-2",
        )}
      >
        {settings.image_url ? (
          <Image
            src={settings.image_url}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="from-secondary to-muted absolute inset-0 bg-gradient-to-br" />
        )}
      </div>
      <div className="flex flex-col items-start gap-5">
        {heading && <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{heading}</h2>}
        {body && <RichText text={body} className="text-base" />}
        {button && (
          <Button asChild size="lg" className="h-12 px-8">
            <Link href={button.href}>{button.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
