import { z } from "zod";

import { localized_text_schema } from "@repo/core/lib/localized";
import { slug_schema } from "@repo/core/lib/schemas/catalog";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { seo_schema, type Seo } from "@repo/core/lib/schemas/seo";
import { page_sections_schema } from "@repo/core/lib/schemas/theme";

// Custom pages (Online store → Pages): content built from theme sections, at /{lang}/pages/{slug}.
// They aren't part of a theme, so switching themes never loses them.

// At least one language must have a title (it's the page's name in the admin and its h1 fallback).
const page_title_schema = localized_text_schema.refine(
  (value) => Object.values(value).some((text) => (text ?? "").trim().length > 0),
  "required",
);

export const page_seo_schema = seo_schema;
export type PageSeo = Seo;

export const create_page_schema = z.object({ title: page_title_schema, slug: slug_schema });
export type CreatePageInput = z.infer<typeof create_page_schema>;

export const update_page_schema = z.object({
  id: id_schema,
  title: page_title_schema,
  slug: slug_schema,
  seo: page_seo_schema,
  is_published: z.boolean(),
});
export type UpdatePageInput = z.infer<typeof update_page_schema>;

export const save_page_sections_schema = z.object({ id: id_schema, sections: page_sections_schema });
export type SavePageSectionsInput = z.infer<typeof save_page_sections_schema>;

export const page_id_schema = z.object({ id: id_schema });
export type PageIdInput = z.infer<typeof page_id_schema>;
