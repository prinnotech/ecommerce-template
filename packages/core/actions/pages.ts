"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { PageRecord } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, type Caller } from "@repo/core/lib/auth";
import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import {
  create_page_schema,
  page_id_schema,
  page_seo_schema,
  save_page_sections_schema,
  update_page_schema,
  type CreatePageInput,
  type PageIdInput,
  type PageSeo,
  type SavePageSectionsInput,
  type UpdatePageInput,
} from "@repo/core/lib/schemas/pages";
import { slug_schema } from "@repo/core/lib/schemas/catalog";
import type { ThemeSection } from "@repo/core/lib/schemas/theme";
import { revalidateStore } from "@repo/core/lib/store-revalidate";
import { parsePageSections } from "@repo/core/themes/index";
import { defaultSection } from "@repo/core/themes/sections";

// Custom pages (Online store → Pages). Saved directly (no draft), like Shopify pages: a published
// page's changes are live at once; a hidden page is only seen in the theme editor's preview.

export type StorePage = {
  id: string;
  title: LocalizedText;
  slug: string;
  sections: ThemeSection[];
  seo: PageSeo;
  is_published: boolean;
  updated_at: string;
};

function toPage(record: PageRecord): StorePage {
  const title = localized_text_schema.safeParse(record.title);
  const seo = page_seo_schema.safeParse(record.seo);
  return {
    id: record.id,
    title: title.success ? title.data : {},
    slug: record.slug,
    sections: parsePageSections(record.sections),
    seo: seo.success ? seo.data : { title: {}, description: {} },
    is_published: record.is_published,
    updated_at: record.updated_at,
  };
}

function log(caller: Caller, action: string, page: Pick<StorePage, "id" | "slug">) {
  return logActivity({
    actor_id: caller.user_id,
    action,
    target_type: "pages",
    target_id: page.id,
    details: { slug: page.slug },
  });
}

export async function getPages(): Promise<ActionResult<StorePage[]>> {
  const auth = await authorize("pages.view", "view pages");
  if (!auth.ok) return auth;
  try {
    return ok((await getBackend().pages.list()).map(toPage));
  } catch (error) {
    return failFrom(error, "pages", "getPages");
  }
}

// A new page starts hidden, with a title block and a text section to fill in.
export async function createPage(input: CreatePageInput): Promise<ActionResult<StorePage>> {
  const auth = await authorize("pages.edit", "create a page");
  if (!auth.ok) return auth;
  const parsed = create_page_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const record = await getBackend().pages.create({
      title: parsed.data.title,
      slug: parsed.data.slug,
      sections: [
        defaultSection("page_header", { eyebrow: {}, heading: parsed.data.title, subtitle: {} }, "header"),
        defaultSection("rich_text", { heading: {}, body: {}, alignment: "left" }, "text"),
      ],
      seo: { title: {}, description: {} },
    });
    const page = toPage(record);
    await log(auth.caller, "create a page", page);
    return ok(page);
  } catch (error) {
    return failFrom(error, "pages", "createPage");
  }
}

export async function updatePage(input: UpdatePageInput): Promise<ActionResult<null>> {
  const auth = await authorize("pages.edit", "edit a page");
  if (!auth.ok) return auth;
  const parsed = update_page_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const { id, ...fields } = parsed.data;
    await getBackend().pages.update(id, fields);
    await log(auth.caller, "edit a page", parsed.data);
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "pages", "updatePage");
  }
}

// Autosave from the theme editor. Not logged (it runs every few seconds while typing).
export async function savePageSections(input: SavePageSectionsInput): Promise<ActionResult<null>> {
  const auth = await authorize("pages.edit", "edit a page");
  if (!auth.ok) return auth;
  const parsed = save_page_sections_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    // Only sections a custom page may have (no product block).
    await getBackend().pages.update(parsed.data.id, { sections: parsePageSections(parsed.data.sections) });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "pages", "savePageSections");
  }
}

export async function deletePage(input: PageIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("pages.edit", "delete a page");
  if (!auth.ok) return auth;
  const parsed = page_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const record = await getBackend().pages.get(parsed.data.id);
    if (!record) return fail("not_found");
    await getBackend().pages.remove(record.id);
    await log(auth.caller, "delete a page", record);
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "pages", "deletePage");
  }
}

// Public: the storefront's /pages/[slug]. Hidden or unknown pages are "not found".
export async function getStorePage(slug: string): Promise<ActionResult<StorePage>> {
  if (!slug_schema.safeParse(slug).success) return fail("not_found");
  try {
    const record = await getBackend().pages.getPublishedBySlug(slug);
    return record ? ok(toPage(record)) : fail("not_found");
  } catch (error) {
    return failFrom(error, "pages", "getStorePage");
  }
}

// Public: published pages for the sitemap.
export async function getPublishedPages(): Promise<ActionResult<{ slug: string; updated_at: string }[]>> {
  try {
    const all = await getBackend().pages.list();
    return ok(
      all.filter((page) => page.is_published).map((page) => ({ slug: page.slug, updated_at: page.updated_at })),
    );
  } catch (error) {
    return failFrom(error, "pages", "getPublishedPages");
  }
}
