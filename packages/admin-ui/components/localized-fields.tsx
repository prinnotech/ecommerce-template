"use client";

import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import type { LocalizedText } from "@repo/core/lib/localized";

type LocalizedFieldsProps = {
  id: string;
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  // The admin's language: the tab that opens first (audit P1).
  lang: string;
  // dictionary.common.text_filled / text_missing.
  status_labels: { filled: string; missing: string };
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
};

// Opens on the admin's language; if that one is empty but another has text, opens on the one with
// text, so a product written only in Italian never looks blank.
function initialTab(value: LocalizedText, lang: string): Locale {
  const preferred: Locale = isLocale(lang) ? lang : LOCALES[0];
  if (value[preferred]?.trim()) return preferred;
  return LOCALES.find((locale) => value[locale]?.trim()) ?? preferred;
}

// One tab per store language. A filled dot = has text, a hollow one = still missing.
export function LocalizedFields({
  id,
  label,
  value,
  onChange,
  lang,
  status_labels,
  multiline,
  rows = 6,
  disabled,
  invalid,
  ...aria
}: LocalizedFieldsProps) {
  const setLocale = (locale: Locale, text: string) => onChange({ ...value, [locale]: text });
  const first_tab = initialTab(value, lang);

  return (
    <Tabs defaultValue={first_tab} className="gap-2">
      <TabsList className="h-8">
        {LOCALES.map((locale) => {
          const is_filled = Boolean(value[locale]?.trim());
          return (
            <TabsTrigger key={locale} value={locale} className="gap-1.5 px-2.5 text-xs uppercase">
              {locale}
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full border",
                  is_filled ? "border-success-foreground bg-success-foreground" : "border-muted-foreground/60",
                )}
              />
              <span className="sr-only">({is_filled ? status_labels.filled : status_labels.missing})</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {LOCALES.map((locale) => {
        const control = {
          // The label's htmlFor points at the tab that opens first.
          id: locale === first_tab ? id : `${id}-${locale}`,
          "aria-label": `${label} (${locale.toUpperCase()})`,
          value: value[locale] ?? "",
          disabled,
          "aria-invalid": invalid || undefined,
          ...aria,
        };
        return (
          <TabsContent key={locale} value={locale}>
            {multiline ? (
              <Textarea rows={rows} onChange={(event) => setLocale(locale, event.target.value)} {...control} />
            ) : (
              <Input onChange={(event) => setLocale(locale, event.target.value)} {...control} />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
