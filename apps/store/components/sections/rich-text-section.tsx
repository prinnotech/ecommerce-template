import { RichText } from "@/components/storefront/rich-text";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

export function RichTextSection({ section, lang }: { section: SectionOf<"rich_text">; lang: string }) {
  const locale = lang as Locale;
  const heading = localized(section.settings.heading, locale);
  const body = localized(section.settings.body, locale);
  if (!heading && !body) return null;
  const is_center = section.settings.alignment === "center";

  return (
    <section
      className={cn(
        "mx-auto flex max-w-3xl flex-col gap-5 px-4 py-12 sm:py-16",
        is_center && "items-center text-center",
      )}
    >
      {heading && <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{heading}</h2>}
      {body && <RichText text={body} className={cn("text-base sm:text-lg", is_center && "items-center")} />}
    </section>
  );
}
