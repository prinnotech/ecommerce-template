import Image from "next/image";

import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { StoreMetafield } from "@repo/core/lib/schemas/metafields";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { formatDate, formatNumber } from "@repo/core/lib/utils/format";

type CustomFieldsSectionProps = {
  section: SectionOf<"custom_fields">;
  fields: StoreMetafield[];
  lang: string;
  text: Dictionary["store"]["custom_fields"];
};

const IMAGE_FILE = /\.(avif|gif|jpe?g|png|webp)(\?|$)/i;

function FieldValue({
  field,
  lang,
  text,
}: {
  field: StoreMetafield;
  lang: string;
  text: CustomFieldsSectionProps["text"];
}) {
  const { value } = field;
  switch (field.type) {
    case "text":
    case "multiline":
      return (
        <span className="whitespace-pre-line">{typeof value === "object" ? localized(value, lang as Locale) : ""}</span>
      );
    case "number":
      return <span className="tabular-nums">{typeof value === "number" ? formatNumber(value, lang) : ""}</span>;
    case "boolean":
      return <span>{value === true ? text.yes : text.no}</span>;
    case "date":
      return <time dateTime={String(value)}>{formatDate(`${String(value)}T12:00:00Z`, lang)}</time>;
    case "url":
      return (
        <a href={String(value)} className="break-all underline underline-offset-4" rel="noopener noreferrer">
          {String(value).replace(/^https?:\/\//, "")}
        </a>
      );
    case "color":
      return (
        <span className="flex items-center gap-2">
          {/* The colour itself is the value: a computed style is the only way to show it. */}
          <span className="size-4 rounded-full border" style={{ backgroundColor: String(value) }} aria-hidden />
          <span className="font-mono text-sm uppercase">{String(value)}</span>
        </span>
      );
    case "file":
      return IMAGE_FILE.test(String(value)) ? (
        <span className="bg-muted relative block size-20 overflow-hidden rounded-md">
          <Image src={String(value)} alt="" fill unoptimized sizes="5rem" className="object-cover" />
        </span>
      ) : (
        <a href={String(value)} className="underline underline-offset-4" rel="noopener noreferrer">
          {text.open_file}
        </a>
      );
  }
}

// The product's custom fields as a list of name and value. Hidden when the product has none.
export function CustomFieldsSection({ section, fields, lang, text }: CustomFieldsSectionProps) {
  const wanted = section.settings.keys
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const shown = wanted.length > 0 ? wanted.flatMap((key) => fields.filter((field) => field.key === key)) : fields;
  if (shown.length === 0) return null;
  const locale = lang as Locale;
  const heading = localized(section.settings.heading, locale);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="max-w-2xl">
        {heading && <h2 className="font-display mb-6 text-2xl font-medium tracking-tight">{heading}</h2>}
        <dl className="divide-y border-y">
          {shown.map((field) => (
            <div key={field.key} className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-muted-foreground text-sm">{localized(field.name, locale) || field.key}</dt>
              <dd className="text-sm">
                <FieldValue field={field} lang={lang} text={text} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
