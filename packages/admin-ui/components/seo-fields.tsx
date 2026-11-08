"use client";

import { useState } from "react";

import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { isLocale, LOCALES, type Locale } from "@repo/core/i18nConfig";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized, type LocalizedText } from "@repo/core/lib/localized";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, type Seo } from "@repo/core/lib/schemas/seo";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";

type SeoFieldsProps = {
  id: string;
  value: Seo;
  onChange: (value: Seo) => void;
  // What search engines get when a field is empty: the item's own title and text.
  fallback: { title: LocalizedText; description: LocalizedText };
  // The store link without the language, e.g. "https://shop.example/…/shop/linen-shirt".
  url: (locale: Locale) => string;
  lang: string;
  disabled?: boolean;
  status_labels: { filled: string; missing: string };
  dictionary: AdminDictionary["admin_ui"]["seo"];
};

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// "Search engine listing": title and description per language, with a preview of how a search
// result could look (in the language picked under it).
export function SeoFields({
  id,
  value,
  onChange,
  fallback,
  url,
  lang,
  disabled,
  status_labels,
  dictionary,
}: SeoFieldsProps) {
  const [preview_lang, setPreviewLang] = useState<Locale>(isLocale(lang) ? lang : LOCALES[0]);
  const title = clip(localized(value.title, preview_lang) || localized(fallback.title, preview_lang), SEO_TITLE_MAX);
  const description = clip(
    localized(value.description, preview_lang) || localized(fallback.description, preview_lang),
    SEO_DESCRIPTION_MAX / 2,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/40 flex flex-col gap-0.5 rounded-md border p-3" aria-label={dictionary.preview}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-xs">{url(preview_lang)}</span>
          <span className="flex gap-1" role="group" aria-label={dictionary.preview_language}>
            {LOCALES.map((locale) => (
              <button
                key={locale}
                type="button"
                aria-pressed={locale === preview_lang}
                onClick={() => setPreviewLang(locale)}
                className="text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground rounded px-1.5 text-xs uppercase"
              >
                {locale}
              </button>
            ))}
          </span>
        </div>
        <span className="text-primary truncate text-base underline-offset-2">{title || dictionary.no_title}</span>
        <span className="text-muted-foreground line-clamp-2 text-sm">{description || dictionary.no_description}</span>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>{dictionary.title}</FieldLabel>
        <LocalizedFields
          id={`${id}-title`}
          label={dictionary.title}
          value={value.title}
          onChange={(title) => onChange({ ...value, title })}
          lang={lang}
          status_labels={status_labels}
          disabled={disabled}
        />
        <FieldDescription>{dictionary.title_hint.replace("{max}", String(SEO_TITLE_MAX))}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-description`}>{dictionary.description}</FieldLabel>
        <LocalizedFields
          id={`${id}-description`}
          label={dictionary.description}
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
          lang={lang}
          status_labels={status_labels}
          multiline
          rows={3}
          disabled={disabled}
        />
        <FieldDescription>{dictionary.description_hint}</FieldDescription>
      </Field>
    </div>
  );
}
