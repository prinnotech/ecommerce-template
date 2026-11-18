"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { FALLBACK_LOCALE, type Locale } from "@repo/core/i18nConfig";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { translateTexts, TranslateError } from "@repo/core/lib/ai/translate";
import { authorize } from "@repo/core/lib/auth";
import {
  CONTENT_KINDS,
  translatableFields,
  withTranslation,
  type ContentKind,
  type TranslatableField,
} from "@repo/core/lib/content-translation";
import { storeLocales } from "@repo/core/lib/languages";
import { localized, locale_code_schema } from "@repo/core/lib/localized";
import type { Permission } from "@repo/core/lib/permissions";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { revalidateStore } from "@repo/core/lib/store-revalidate";

// Settings → Languages → Products / Categories / Collections / Pages: a language's version of the
// store's content. Each record's per-language texts are found by walking the fields below
// (lib/content-translation.ts); a save writes the record back through the normal backend update.

const PERMISSIONS: Record<ContentKind, { view: Permission; edit: Permission }> = {
  products: { view: "products.view", edit: "products.edit" },
  categories: { view: "categories.view", edit: "categories.edit" },
  collections: { view: "collections.view", edit: "collections.edit" },
  pages: { view: "pages.view", edit: "pages.edit" },
};

const PRODUCT_PAGE_SIZE = 20;

export type ContentItem = { id: string; label: string; fields: TranslatableField[] };
export type ContentPage = { items: ContentItem[]; page: number; total_pages: number };

// The translatable part of each kind of record, and how to save it back.
type Adapter = {
  load(
    page: number,
    search: string,
  ): Promise<{ records: { id: string; value: Record<string, unknown> }[]; total_pages: number }>;
  get(id: string): Promise<Record<string, unknown>>;
  save(id: string, value: Record<string, unknown>): Promise<void>;
};

function adapter(kind: ContentKind): Adapter {
  const backend = getBackend();
  switch (kind) {
    case "products":
      return {
        async load(page, search) {
          const rows = await backend.catalog.listProducts(
            { search, status: "all", category: "", sort: "updated_at", direction: "desc", page },
            PRODUCT_PAGE_SIZE,
          );
          const products = await Promise.all(rows.items.map((row) => backend.catalog.getProduct(row.id)));
          return {
            records: products.map((product) => ({
              id: product.id,
              value: { title: product.title, description: product.description, seo: product.seo },
            })),
            total_pages: rows.total_pages,
          };
        },
        async get(id) {
          const product = await backend.catalog.getProduct(id);
          return { title: product.title, description: product.description, seo: product.seo };
        },
        async save(id, value) {
          const product = await backend.catalog.getProduct(id);
          await backend.catalog.updateProduct(id, {
            title: value.title as typeof product.title,
            description: value.description as typeof product.description,
            seo: value.seo as typeof product.seo,
            slug: product.slug,
            category: product.category,
            price: product.price,
            compare_at_price: product.compare_at_price,
            status: product.status,
            is_featured: product.is_featured,
            is_gift_card: product.is_gift_card,
            tags: product.tags,
          });
        },
      };
    case "categories":
      return {
        async load() {
          const categories = await backend.catalog.listCategories();
          return {
            records: categories.map((category) => ({
              id: category.id,
              value: { name: category.name, description: category.description, seo: category.seo },
            })),
            total_pages: 1,
          };
        },
        async get(id) {
          const category = (await backend.catalog.listCategories()).find((item) => item.id === id);
          if (!category) throw new Error("not_found");
          return { name: category.name, description: category.description, seo: category.seo };
        },
        async save(id, value) {
          const category = (await backend.catalog.listCategories()).find((item) => item.id === id);
          if (!category) throw new Error("not_found");
          await backend.catalog.updateCategory(id, {
            name: value.name as typeof category.name,
            description: value.description as typeof category.description,
            seo: value.seo as typeof category.seo,
            slug: category.slug,
            parent: category.parent,
            sort_order: category.sort_order,
            is_active: category.is_active,
          });
        },
      };
    case "collections":
      return {
        async load() {
          const collections = await backend.collections.list();
          return {
            records: collections.map((collection) => ({
              id: collection.id,
              value: { title: collection.title, description: collection.description, seo: collection.seo },
            })),
            total_pages: 1,
          };
        },
        async get(id) {
          const collection = await backend.collections.get(id);
          return { title: collection.title, description: collection.description, seo: collection.seo };
        },
        async save(id, value) {
          const {
            id: _id,
            sort_order,
            product_ids,
            created_at,
            updated_at,
            ...input
          } = await backend.collections.get(id);
          await backend.collections.update(id, {
            ...input,
            title: value.title as typeof input.title,
            description: value.description as typeof input.description,
            seo: value.seo as typeof input.seo,
          });
        },
      };
    case "pages":
      return {
        async load() {
          const pages = await backend.pages.list();
          return {
            records: pages.map((page) => ({
              id: page.id,
              value: { title: page.title, sections: page.sections, seo: page.seo },
            })),
            total_pages: 1,
          };
        },
        async get(id) {
          const page = await backend.pages.get(id);
          if (!page) throw new Error("not_found");
          return { title: page.title, sections: page.sections, seo: page.seo };
        },
        async save(id, value) {
          await backend.pages.update(id, { title: value.title, sections: value.sections, seo: value.seo });
        },
      };
  }
}

// The language content is written in: the store's default language.
async function sourceLocale(): Promise<Locale> {
  return (await getSiteSettings()).DEFAULT_LOCALE || FALLBACK_LOCALE;
}

const list_schema = z.object({
  locale: locale_code_schema,
  kind: z.enum(CONTENT_KINDS),
  page: z.number().int().min(1).max(10_000).catch(1),
  search: z.string().trim().max(100).catch(""),
});

export async function getContentTranslations(input: unknown): Promise<ActionResult<ContentPage>> {
  const parsed = list_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { locale, kind, page, search } = parsed.data;
  const auth = await authorize(PERMISSIONS[kind].view, `view ${kind} translations`);
  if (!auth.ok) return auth;
  try {
    const settings = await getSiteSettings();
    if (!storeLocales(settings.LANGUAGES).includes(locale)) return fail("not_found");
    const source = await sourceLocale();
    const { records, total_pages } = await adapter(kind).load(page, search);
    return ok({
      items: records.map((record) => {
        const label_field = (record.value.title ?? record.value.name) as unknown;
        return {
          id: record.id,
          label: localized(label_field, source) || record.id,
          fields: translatableFields(record.value, locale, source),
        };
      }),
      page,
      total_pages,
    });
  } catch (error) {
    return failFrom(error, "content-translations", "getContentTranslations");
  }
}

const save_schema = z.object({
  locale: locale_code_schema,
  kind: z.enum(CONTENT_KINDS),
  id: id_schema,
  // path → text in `locale` ("" removes it).
  fields: z.record(z.string().max(500), z.string().max(10_000)),
});

export async function saveContentTranslation(input: unknown): Promise<ActionResult<null>> {
  const parsed = save_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { locale, kind, id, fields } = parsed.data;
  const auth = await authorize(PERMISSIONS[kind].edit, `translate ${kind}`);
  if (!auth.ok) return auth;
  try {
    const target = adapter(kind);
    let value = await target.get(id);
    for (const [path, text] of Object.entries(fields)) {
      const next = withTranslation(value, path, locale, text);
      if (next) value = next;
    }
    await target.save(id, value);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: `translate ${kind}`,
      target_type: kind,
      target_id: id,
      details: { locale, fields: Object.keys(fields).length },
    });
    revalidatePath("/", "layout");
    await revalidateStore();
    return ok(null);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return fail("not_found");
    return failFrom(error, "content-translations", "saveContentTranslation");
  }
}

const translate_schema = z.object({
  locale: locale_code_schema,
  kind: z.enum(CONTENT_KINDS),
  // "<item id>|<path>" → source text, at most one batch.
  texts: z.record(z.string().max(600), z.string().max(10_000)),
});

// AI drafts for content texts (not saved: the screen shows them, the owner saves each item).
export async function translateContent(input: unknown): Promise<ActionResult<Record<string, string>>> {
  const parsed = translate_schema.safeParse(input);
  if (!parsed.success || Object.keys(parsed.data.texts).length > 80) return fail("invalid_input");
  const { locale, kind, texts } = parsed.data;
  const auth = await authorize(PERMISSIONS[kind].edit, `translate ${kind} with AI`);
  if (!auth.ok) return auth;
  try {
    const source = await sourceLocale();
    if (locale === source) return fail("invalid_input");
    const context =
      kind === "pages"
        ? "Headings, text and buttons of the store's own pages."
        : `Names, descriptions and search-engine texts of the store's ${kind}.`;
    return ok(await translateTexts(texts, source, locale, context));
  } catch (error) {
    if (error instanceof TranslateError) return fail(error.code);
    return failFrom(error, "content-translations", "translateContent");
  }
}
