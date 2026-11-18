import { isLocale, type Locale } from "@repo/core/i18nConfig";

// Translating catalog and page content (Settings → Languages → Products, Pages…): every per-language
// text inside a record ({ en: "…", es: "…" }), found by walking it, with a path to write the
// translation back. Paths are segments joined by "/"; list items are "#<id>" (or "#<index>" when an
// item has no id), so reordering sections doesn't move a translation onto another item.

export const CONTENT_KINDS = ["products", "categories", "collections", "pages"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export type TranslatableField = {
  path: string;
  // The text to translate from (the source language, else the first language that has text).
  source: string;
  // The text in the target language ("" = missing).
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// { en: "Shirt", it: "Camicia" }: every key a language code, every value text.
function isLocalizedText(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key, text]) => isLocale(key) && typeof text === "string");
}

function itemSegment(item: unknown, index: number): string {
  return isRecord(item) && typeof item.id === "string" ? `#${item.id}` : `#${index}`;
}

export function translatableFields(
  value: unknown,
  locale: Locale,
  source_locale: Locale,
  prefix = "",
): TranslatableField[] {
  if (isLocalizedText(value)) {
    const source =
      value[source_locale]?.trim() ||
      Object.entries(value).find(([key, text]) => key !== locale && text.trim())?.[1] ||
      "";
    return source ? [{ path: prefix, source, value: value[locale] ?? "" }] : [];
  }
  const join = (segment: string) => (prefix ? `${prefix}/${segment}` : segment);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      translatableFields(item, locale, source_locale, join(itemSegment(item, index))),
    );
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, inner]) => translatableFields(inner, locale, source_locale, join(key)));
  }
  return [];
}

// A copy of `root` with `text` in `locale` at `path` ("" removes that language's text). Returns
// null when the path no longer leads to a per-language text (the record changed meanwhile).
export function withTranslation<T>(root: T, path: string, locale: Locale, text: string): T | null {
  const copy: unknown = structuredClone(root);
  let node: unknown = copy;
  for (const segment of path.split("/")) {
    if (segment.startsWith("#") && Array.isArray(node)) {
      const key = segment.slice(1);
      node = node.find((item, index) => itemSegment(item, index) === segment) ?? node[Number(key)];
    } else if (isRecord(node)) {
      node = node[segment];
    } else {
      return null;
    }
  }
  if (!isLocalizedText(node)) return null;
  if (text.trim()) node[locale] = text;
  else delete node[locale];
  return copy as T;
}
