import type { LocalizedText } from "@repo/core/lib/localized";
import {
  FIXED_SECTION,
  announcement_schema,
  footer_schema,
  header_schema,
  HEADER_LAYOUTS,
  MAX_SECTIONS,
  section_schema,
  sectionTypesFor,
  theme_settings_schema,
  type PageKind,
  type ThemeData,
  type ThemeSection,
} from "@repo/core/lib/schemas/theme";
import { atelier } from "@repo/core/themes/templates/atelier";
import { bold } from "@repo/core/themes/templates/bold";
import { classic } from "@repo/core/themes/templates/classic";
import { minimal } from "@repo/core/themes/templates/minimal";
import type { ThemeTemplate } from "@repo/core/themes/types";

export type { ThemeTemplate };

// The gallery, in display order. The first one is what a store without any theme looks like.
export const TEMPLATES = [atelier, minimal, bold, classic] as const satisfies readonly ThemeTemplate[];
export type TemplateId = (typeof TEMPLATES)[number]["id"];
export const DEFAULT_TEMPLATE: ThemeTemplate = atelier;

export function findTemplate(id: string): ThemeTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function templateOrDefault(id: string): ThemeTemplate {
  return findTemplate(id) ?? DEFAULT_TEMPLATE;
}

// A fresh copy, so editing a theme never touches the template object.
export function templateData(id: string): ThemeData {
  return structuredClone(templateOrDefault(id).data);
}

// Values a theme saved before page templates existed (phase 6b) may still need.
export type LegacyThemeValues = { about_text?: LocalizedText };

function parseSections(raw: unknown, kind: PageKind, fallback: ThemeSection[]): ThemeSection[] {
  if (!Array.isArray(raw)) return fallback;
  const fixed = FIXED_SECTION[kind];
  const allowed = new Set<string>(fixed ? [...sectionTypesFor(kind), fixed] : sectionTypesFor(kind));
  return raw
    .slice(0, MAX_SECTIONS)
    .map((section) => section_schema.safeParse(section))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter((section) => allowed.has(section.type));
}

// Sections of a custom page (Online store → Pages): the same rules as About and Contact.
export function parsePageSections(raw: unknown): ThemeSection[] {
  return parseSections(raw, "custom", []);
}

// The product and collection pages always have exactly one of their fixed block (first if it
// went missing).
function withFixedSection(kind: PageKind, sections: ThemeSection[], fallback: ThemeSection[]): ThemeSection[] {
  const type = FIXED_SECTION[kind];
  if (!type) return sections;
  const main = sections.filter((section) => section.type === type);
  if (main.length === 1) return sections;
  const rest = sections.filter((section) => section.type !== type);
  const block = main[0] ?? fallback.find((section) => section.type === type);
  return block ? [block, ...rest].slice(0, MAX_SECTIONS) : rest;
}

type LegacyHeader = { layout?: unknown; show_utility_bar?: unknown; announcement?: unknown };

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

// Header and footer groups. A theme saved before them kept its header options in
// settings.header (layout, contact bar, one announcement text): those move into the groups.
function parseHeaderGroup(raw: unknown, legacy_header: unknown, fallback: ThemeData["header_group"]) {
  const stored = record(raw);
  const legacy = record(legacy_header) as LegacyHeader;
  const layout = HEADER_LAYOUTS.find((value) => value === legacy.layout);
  const legacy_text = record(legacy.announcement);
  const has_legacy_text = Object.values(legacy_text).some((value) => typeof value === "string" && value);
  const announcement = announcement_schema.safeParse(stored.announcement);
  const header = header_schema.safeParse(stored.header);
  return {
    announcement: announcement.success
      ? announcement.data
      : {
          ...fallback.announcement,
          messages: has_legacy_text
            ? [{ id: "legacy", text: legacy_text as Record<string, string>, href: "" }]
            : fallback.announcement.messages,
        },
    header: header.success
      ? header.data
      : {
          ...fallback.header,
          ...(layout ? { layout } : {}),
          ...(typeof legacy.show_utility_bar === "boolean" ? { show_utility_bar: legacy.show_utility_bar } : {}),
        },
  };
}

function parseFooterGroup(raw: unknown, fallback: ThemeData["footer_group"]): ThemeData["footer_group"] {
  const footer = footer_schema.safeParse(record(raw).footer);
  return { footer: footer.success ? footer.data : fallback.footer };
}

// Stored theme JSON → valid data. Invalid settings fall back to the template's; invalid sections
// are dropped one by one, so one bad section never blanks a page. A theme from before page
// templates ({ settings, sections }) keeps its home page and gets the template's other pages;
// the old ABOUT_CONTENT setting fills its About text.
export function parseThemeData(raw: unknown, template_id: string, legacy: LegacyThemeValues = {}): ThemeData {
  const fallback = templateData(template_id);
  if (typeof raw !== "object" || raw === null) return fallback;
  const value = raw as {
    settings?: unknown;
    sections?: unknown;
    pages?: Record<string, unknown>;
    header_group?: unknown;
    footer_group?: unknown;
  };
  const settings = theme_settings_schema.safeParse(value.settings);
  const is_legacy = value.pages === undefined;
  const stored = value.pages ?? {};

  const data: ThemeData = {
    settings: settings.success ? settings.data : fallback.settings,
    header_group: parseHeaderGroup(value.header_group, record(value.settings).header, fallback.header_group),
    footer_group: parseFooterGroup(value.footer_group, fallback.footer_group),
    pages: {
      home: parseSections(is_legacy ? value.sections : stored.home, "home", fallback.pages.home),
      product: withFixedSection(
        "product",
        parseSections(stored.product, "product", fallback.pages.product),
        fallback.pages.product,
      ),
      // Themes saved before the collection template get the template's.
      collection: withFixedSection(
        "collection",
        parseSections(stored.collection, "collection", fallback.pages.collection),
        fallback.pages.collection,
      ),
      about: parseSections(stored.about, "about", fallback.pages.about),
      contact: parseSections(stored.contact, "contact", fallback.pages.contact),
    },
  };
  return is_legacy ? withLegacyValues(data, legacy) : data;
}

// Puts the old ABOUT_CONTENT text into the About page's text section. Used for themes from before
// page templates and for the default theme of a store that has none yet.
export function withLegacyValues(data: ThemeData, legacy: LegacyThemeValues): ThemeData {
  const about_text = legacy.about_text ?? {};
  if (!Object.values(about_text).some(Boolean)) return data;
  const about = data.pages.about.map((section) =>
    section.type === "rich_text" ? { ...section, settings: { ...section.settings, body: about_text } } : section,
  );
  return { ...data, pages: { ...data.pages, about } };
}
