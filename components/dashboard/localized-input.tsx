"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LOCALES, type Locale } from "@/i18nConfig";
import type { LocalizedText } from "@/lib/localized";

type LocalizedInputProps = {
  id: string;
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
};

// One tab per store language. A dot marks languages that still need text.
export function LocalizedInput({
  id,
  label,
  value,
  onChange,
  multiline,
  rows = 6,
  disabled,
  invalid,
  ...aria
}: LocalizedInputProps) {
  const setLocale = (locale: Locale, text: string) => onChange({ ...value, [locale]: text });

  return (
    <Tabs defaultValue={LOCALES[0]} className="gap-2">
      <TabsList className="h-8">
        {LOCALES.map((locale) => (
          <TabsTrigger key={locale} value={locale} className="gap-1.5 px-2.5 text-xs uppercase">
            {locale}
            {!value[locale]?.trim() && <span className="bg-muted-foreground/50 size-1.5 rounded-full" aria-hidden />}
          </TabsTrigger>
        ))}
      </TabsList>
      {LOCALES.map((locale) => {
        const control = {
          id: locale === LOCALES[0] ? id : `${id}-${locale}`,
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
