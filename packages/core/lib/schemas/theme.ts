import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";
import { localized_text_schema } from "@repo/core/lib/localized";
import { FONT_IDS } from "@repo/core/themes/fonts";

// A theme's content: its look (settings) and its home page (sections). Templates provide the
// defaults; a stored theme only has to be valid against this schema, and anything that isn't is
// replaced by the template's value (see parseThemeData in themes/index.ts).

const hex_color_schema = z.string().regex(/^#[0-9a-f]{6}$/i, "invalid");
// An image or a link: an absolute URL, a site path ("/shop?sort=newest") or nothing.
const url_or_path_schema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//.test(value), "invalid");

export const palette_schema = z.object({
  background: hex_color_schema,
  foreground: hex_color_schema,
  // Buttons, the announcement bar and other accents.
  primary: hex_color_schema,
  // Soft surfaces: banners, placeholders, image tiles.
  muted: hex_color_schema,
});
export type Palette = z.infer<typeof palette_schema>;

export const RADII = ["none", "small", "medium", "large"] as const;
export const BUTTON_STYLES = ["solid", "pill", "outline"] as const;
export const HEADER_LAYOUTS = ["inline", "centered", "inverted"] as const;
export const CARD_STYLES = ["plain", "framed", "minimal", "bold"] as const;

export const theme_settings_schema = z.object({
  colors: z.object({ light: palette_schema, dark: palette_schema }),
  fonts: z.object({ heading: z.enum(FONT_IDS), body: z.enum(FONT_IDS) }),
  // Headings in capitals with wide spacing (Bold).
  is_uppercase_headings: z.boolean(),
  radius: z.enum(RADII),
  buttons: z.enum(BUTTON_STYLES),
  header: z.object({
    layout: z.enum(HEADER_LAYOUTS),
    // A thin bar above the header with the phone and email (Classic).
    show_utility_bar: z.boolean(),
    // Empty = the free-shipping message when FREE_SHIPPING_THRESHOLD is set, or no bar.
    announcement: localized_text_schema,
  }),
  product_card: z.enum(CARD_STYLES),
});
export type ThemeSettings = z.infer<typeof theme_settings_schema>;

const button_schema = z.object({ label: localized_text_schema, href: url_or_path_schema });
export type ThemeButton = z.infer<typeof button_schema>;

const heading_schema = localized_text_schema;
const section_base = { id: z.string().min(1).max(40), is_hidden: z.boolean() };

export const hero_section_schema = z.object({
  ...section_base,
  type: z.literal("hero"),
  settings: z.object({
    image_url: url_or_path_schema,
    heading: heading_schema,
    subtitle: localized_text_schema,
    primary_button: button_schema,
    secondary_button: button_schema,
    alignment: z.enum(["center", "left"]),
    size: z.enum(["medium", "large"]),
  }),
});

export const trust_badges_section_schema = z.object({
  ...section_base,
  type: z.literal("trust_badges"),
  settings: z.object({}),
});

export const category_tiles_section_schema = z.object({
  ...section_base,
  type: z.literal("category_tiles"),
  settings: z.object({
    heading: heading_schema,
    // Empty = the first top-level categories, up to `limit`.
    category_ids: z.array(id_schema).max(8),
    limit: z.number().int().min(2).max(8),
  }),
});

export const PRODUCT_SOURCES = ["featured", "newest", "category", "collection"] as const;
export const product_grid_section_schema = z.object({
  ...section_base,
  type: z.literal("product_grid"),
  settings: z.object({
    heading: heading_schema,
    source: z.enum(PRODUCT_SOURCES),
    // Used when source = "category".
    category_id: z.union([id_schema, z.literal("")]),
    // Used when source = "collection" (themes saved before collections have none).
    collection_id: z.union([id_schema, z.literal("")]).catch(""),
    limit: z.number().int().min(2).max(12),
    show_view_all: z.boolean(),
  }),
});

export const image_with_text_section_schema = z.object({
  ...section_base,
  type: z.literal("image_with_text"),
  settings: z.object({
    image_url: url_or_path_schema,
    heading: heading_schema,
    body: localized_text_schema,
    button: button_schema,
    image_position: z.enum(["left", "right"]),
  }),
});

export const rich_text_section_schema = z.object({
  ...section_base,
  type: z.literal("rich_text"),
  settings: z.object({
    heading: heading_schema,
    // Plain paragraphs separated by blank lines.
    body: localized_text_schema,
    alignment: z.enum(["center", "left"]),
  }),
});

export const newsletter_section_schema = z.object({
  ...section_base,
  type: z.literal("newsletter"),
  settings: z.object({ heading: heading_schema, body: localized_text_schema }),
});

// A short list item id, made in the editor (stable keys while reordering).
const item_id_schema = z.string().min(1).max(40);

export const faq_section_schema = z.object({
  ...section_base,
  type: z.literal("faq"),
  settings: z.object({
    heading: heading_schema,
    items: z
      .array(z.object({ id: item_id_schema, question: localized_text_schema, answer: localized_text_schema }))
      .max(30),
  }),
});

export const GALLERY_COLUMNS = [2, 3, 4] as const;
export const gallery_section_schema = z.object({
  ...section_base,
  type: z.literal("gallery"),
  settings: z.object({
    heading: heading_schema,
    images: z
      .array(
        z.object({
          id: item_id_schema,
          image_url: url_or_path_schema,
          caption: localized_text_schema,
          href: url_or_path_schema,
        }),
      )
      .max(12),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  }),
});

// A YouTube or Vimeo link, or a video file (mp4/webm).
export const video_section_schema = z.object({
  ...section_base,
  type: z.literal("video"),
  settings: z.object({ heading: heading_schema, url: url_or_path_schema, caption: localized_text_schema }),
});

export const spacer_section_schema = z.object({
  ...section_base,
  type: z.literal("spacer"),
  settings: z.object({ size: z.enum(["small", "medium", "large"]), show_divider: z.boolean() }),
});

// The title block at the top of About, Contact and custom pages.
export const page_header_section_schema = z.object({
  ...section_base,
  type: z.literal("page_header"),
  settings: z.object({
    eyebrow: localized_text_schema,
    heading: heading_schema,
    subtitle: localized_text_schema,
    alignment: z.enum(["center", "left"]),
  }),
});

export const contact_form_section_schema = z.object({
  ...section_base,
  type: z.literal("contact_form"),
  settings: z.object({ heading: heading_schema, show_details: z.boolean() }),
});

// Product page only. The product itself (photos, price, sizes, add to cart): fixed, one per page.
export const product_main_section_schema = z.object({
  ...section_base,
  type: z.literal("product_main"),
  settings: z.object({ show_assurances: z.boolean() }),
});

// Product page only: products from the same category.
export const related_products_section_schema = z.object({
  ...section_base,
  type: z.literal("related_products"),
  settings: z.object({ heading: heading_schema, limit: z.number().int().min(2).max(12) }),
});

export const section_schema = z.discriminatedUnion("type", [
  hero_section_schema,
  trust_badges_section_schema,
  category_tiles_section_schema,
  product_grid_section_schema,
  image_with_text_section_schema,
  rich_text_section_schema,
  newsletter_section_schema,
  faq_section_schema,
  gallery_section_schema,
  video_section_schema,
  spacer_section_schema,
  page_header_section_schema,
  contact_form_section_schema,
  product_main_section_schema,
  related_products_section_schema,
]);
export type ThemeSection = z.infer<typeof section_schema>;
export type SectionType = ThemeSection["type"];
export type SectionOf<T extends SectionType> = Extract<ThemeSection, { type: T }>;

// Every section type, in the order of the editor's "Add section" menu.
export const SECTION_TYPES = [
  "hero",
  "page_header",
  "rich_text",
  "image_with_text",
  "gallery",
  "video",
  "product_grid",
  "related_products",
  "category_tiles",
  "trust_badges",
  "faq",
  "contact_form",
  "newsletter",
  "spacer",
  "product_main",
] as const satisfies readonly SectionType[];

export const MAX_SECTIONS = 20;

// The pages a theme lays out. Custom pages (Online store → Pages) use the "custom" rules.
export const THEME_PAGES = ["home", "product", "about", "contact"] as const;
export type ThemePage = (typeof THEME_PAGES)[number];
export type PageKind = ThemePage | "custom";

const PRODUCT_ONLY: readonly SectionType[] = ["product_main", "related_products"];

// Which sections a page can have. The product page's "product_main" is fixed (added once, never
// removed or added by hand), so it isn't offered in "Add section".
export function sectionTypesFor(kind: PageKind): SectionType[] {
  return SECTION_TYPES.filter((type) => (kind === "product" ? type !== "product_main" : !PRODUCT_ONLY.includes(type)));
}

export function isFixedSection(section: Pick<ThemeSection, "type">): boolean {
  return section.type === "product_main";
}

export const page_sections_schema = z.array(section_schema).max(MAX_SECTIONS);

export const theme_data_schema = z.object({
  settings: theme_settings_schema,
  pages: z.object({
    home: page_sections_schema,
    product: page_sections_schema,
    about: page_sections_schema,
    contact: page_sections_schema,
  }),
});
export type ThemeData = z.infer<typeof theme_data_schema>;

// ---------- Action inputs ----------

export const theme_id_schema = z.object({ id: id_schema });
export type ThemeIdInput = z.infer<typeof theme_id_schema>;

export const theme_name_schema = z.string("required").trim().min(1, "required").max(60, "too_long");

export const add_theme_schema = z.object({ template: z.string().min(1).max(40) });
export type AddThemeInput = z.infer<typeof add_theme_schema>;

export const rename_theme_schema = z.object({ id: id_schema, name: theme_name_schema });
export type RenameThemeInput = z.infer<typeof rename_theme_schema>;

export const save_theme_draft_schema = z.object({ id: id_schema, data: theme_data_schema });
export type SaveThemeDraftInput = z.infer<typeof save_theme_draft_schema>;

export const restore_theme_version_schema = z.object({ id: id_schema, published_at: z.iso.datetime() });
export type RestoreThemeVersionInput = z.infer<typeof restore_theme_version_schema>;
