import { z } from "zod";

import { localized_text_schema } from "@repo/core/lib/localized";

// "Search engine listing" for products, categories and custom pages: per-language title and
// description. Empty = the page's own title and text are used.
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 320;

export const seo_schema = z.object({ title: localized_text_schema, description: localized_text_schema });
export type Seo = z.infer<typeof seo_schema>;
export const EMPTY_SEO: Seo = { title: {}, description: {} };

// Stored values that don't parse (older rows, null) become empty.
export function parseSeo(value: unknown): Seo {
  return seo_schema.catch(EMPTY_SEO).parse(value ?? EMPTY_SEO);
}
