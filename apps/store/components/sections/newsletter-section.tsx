import { NewsletterForm } from "./newsletter-form";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";

type NewsletterSectionProps = { section: SectionOf<"newsletter">; lang: string; dictionary: Dictionary };

export function NewsletterSection({ section, lang, dictionary }: NewsletterSectionProps) {
  const locale = lang as Locale;
  const heading = localized(section.settings.heading, locale);
  const body = localized(section.settings.body, locale);

  return (
    <section className="bg-muted/50 border-y">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-14 text-center sm:py-16">
        {heading && <h2 className="font-display text-3xl font-medium tracking-tight">{heading}</h2>}
        {body && <p className="text-muted-foreground max-w-md">{body}</p>}
        <NewsletterForm
          id={`newsletter-${section.id}`}
          lang={lang}
          dictionary={dictionary.newsletter}
          errors={dictionary.errors}
          validation={dictionary.validation}
        />
      </div>
    </section>
  );
}
