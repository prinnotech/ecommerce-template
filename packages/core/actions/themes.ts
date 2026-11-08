"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { ThemeRecord, ThemeVersion } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { getAdminLocale } from "@repo/core/lib/admin-locale";
import { authorize, type Caller } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import {
  add_theme_schema,
  rename_theme_schema,
  restore_theme_version_schema,
  save_theme_draft_schema,
  theme_id_schema,
  type AddThemeInput,
  type RenameThemeInput,
  type RestoreThemeVersionInput,
  type SaveThemeDraftInput,
  type ThemeData,
  type ThemeIdInput,
  type ThemeSettings,
} from "@repo/core/lib/schemas/theme";
import { SITE_URL } from "@repo/core/lib/site-config";
import { revalidateStore } from "@repo/core/lib/store-revalidate";
import { createPreviewToken } from "@repo/core/lib/theme-signing";
import { defaultThemeData, getLegacyThemeValues } from "@repo/core/lib/theme-server";
import {
  DEFAULT_TEMPLATE,
  findTemplate,
  parseThemeData,
  templateData,
  TEMPLATES,
  type LegacyThemeValues,
} from "@repo/core/themes/index";

// Online store → Themes: a library of themes made from templates (packages/core/themes), one of
// them live. Every change is an action with a typed schema (the future MCP tools reuse them).

const HISTORY_SIZE = 10;

export type ThemeSummary = {
  id: string;
  name: string;
  template: string;
  is_live: boolean;
  has_unpublished_changes: boolean;
  published_at: string;
  updated_at: string;
  // For the thumbnail: the draft's look.
  settings: ThemeSettings;
};

export type TemplateSummary = { id: string; name: string; settings: ThemeSettings; section_count: number };

export type ThemesOverview = { themes: ThemeSummary[]; templates: TemplateSummary[]; store_url: string };

export type ThemeEditorData = {
  id: string;
  name: string;
  template: string;
  is_live: boolean;
  draft: ThemeData;
  has_unpublished_changes: boolean;
  is_published: boolean;
  published_at: string;
  history: { published_at: string }[];
  store_url: string;
  // null when THEME_PREVIEW_SECRET isn't set: the editor explains how to turn the preview on.
  preview_token: string | null;
};

function draftOf(theme: ThemeRecord, legacy: LegacyThemeValues = {}): ThemeData {
  return parseThemeData(theme.draft, theme.template, legacy);
}

function hasChanges(theme: ThemeRecord): boolean {
  return theme.published === null || JSON.stringify(theme.draft) !== JSON.stringify(theme.published);
}

function toSummary(theme: ThemeRecord): ThemeSummary {
  return {
    id: theme.id,
    name: theme.name,
    template: theme.template,
    is_live: theme.is_live,
    has_unpublished_changes: hasChanges(theme),
    published_at: theme.published_at,
    updated_at: theme.updated_at,
    settings: draftOf(theme).settings,
  };
}

function toEditor(theme: ThemeRecord, legacy: LegacyThemeValues): ThemeEditorData {
  return {
    id: theme.id,
    name: theme.name,
    template: theme.template,
    is_live: theme.is_live,
    draft: draftOf(theme, legacy),
    has_unpublished_changes: hasChanges(theme),
    is_published: theme.published !== null,
    published_at: theme.published_at,
    history: theme.history.map((version) => ({ published_at: version.published_at })),
    store_url: SITE_URL,
    preview_token: createPreviewToken(theme.id),
  };
}

function log(caller: Caller, action: string, theme: Pick<ThemeRecord, "id" | "name">, details: object = {}) {
  return logActivity({
    actor_id: caller.user_id,
    action,
    target_type: "themes",
    target_id: theme.id,
    details: { name: theme.name, ...details },
  });
}

class ThemeNotFound extends Error {}

async function getOrFail(id: string): Promise<ThemeRecord> {
  const theme = await getBackend().themes.get(id);
  if (!theme) throw new ThemeNotFound();
  return theme;
}

function failTheme(error: unknown, context: string) {
  if (error instanceof ThemeNotFound) return fail("not_found");
  return failFrom(error, "themes", context);
}

// A store that has never had a theme shows the default template. The first visit to Themes adds it
// to the library as the live theme, so what the owner sees there is what the store shows.
async function ensureLibrary(): Promise<ThemeRecord[]> {
  const backend = getBackend().themes;
  const themes = await backend.list();
  if (themes.length > 0) return themes;
  const data = await defaultThemeData();
  const created = await backend.create({ name: DEFAULT_TEMPLATE.name, template: DEFAULT_TEMPLATE.id, draft: data });
  const published_at = new Date().toISOString();
  const history = [{ published_at, data }];
  await backend.update(created.id, { published: data, published_at, history });
  await backend.setLive(created.id);
  // Built here rather than read back, so the first visit shows it even if a read lags behind.
  return [{ ...created, published: data, published_at, history, is_live: true }];
}

export async function getThemes(): Promise<ActionResult<ThemesOverview>> {
  const auth = await authorize("themes.view", "view themes");
  if (!auth.ok) return auth;

  try {
    const themes = await ensureLibrary();
    return ok({
      themes: themes.map(toSummary),
      templates: TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        settings: template.data.settings,
        section_count: template.data.pages.home.length,
      })),
      store_url: SITE_URL,
    });
  } catch (error) {
    return failFrom(error, "themes", "getThemes");
  }
}

export async function getTheme(input: ThemeIdInput): Promise<ActionResult<ThemeEditorData>> {
  const auth = await authorize("themes.view", "open a theme");
  if (!auth.ok) return auth;
  const parsed = theme_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    return ok(toEditor(await getOrFail(parsed.data.id), await getLegacyThemeValues()));
  } catch (error) {
    return failTheme(error, "getTheme");
  }
}

// Adds a template to the library as a draft theme (not live until published).
export async function addTheme(input: AddThemeInput): Promise<ActionResult<ThemeSummary>> {
  const auth = await authorize("themes.edit", "add a theme");
  if (!auth.ok) return auth;
  const parsed = add_theme_schema.safeParse(input);
  const template = parsed.success ? findTemplate(parsed.data.template) : undefined;
  if (!template) return fail("invalid_input");

  try {
    const theme = await getBackend().themes.create({
      name: template.name,
      template: template.id,
      draft: templateData(template.id),
    });
    await log(auth.caller, "add a theme", theme, { template: template.id });
    return ok(toSummary(theme));
  } catch (error) {
    return failFrom(error, "themes", "addTheme");
  }
}

export async function duplicateTheme(input: ThemeIdInput): Promise<ActionResult<ThemeSummary>> {
  const auth = await authorize("themes.edit", "duplicate a theme");
  if (!auth.ok) return auth;
  const parsed = theme_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const source = await getOrFail(parsed.data.id);
    const dictionary = await getAdminDictionary(await getAdminLocale());
    const theme = await getBackend().themes.create({
      name: dictionary.themes.copy_name.replace("{name}", source.name).slice(0, 60),
      template: source.template,
      draft: draftOf(source, await getLegacyThemeValues()),
    });
    await log(auth.caller, "duplicate a theme", theme, { source_id: source.id });
    return ok(toSummary(theme));
  } catch (error) {
    return failTheme(error, "duplicateTheme");
  }
}

export async function renameTheme(input: RenameThemeInput): Promise<ActionResult<null>> {
  const auth = await authorize("themes.edit", "rename a theme");
  if (!auth.ok) return auth;
  const parsed = rename_theme_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const theme = await getOrFail(parsed.data.id);
    await getBackend().themes.update(theme.id, { name: parsed.data.name });
    await log(auth.caller, "rename a theme", { id: theme.id, name: parsed.data.name }, { previous_name: theme.name });
    return ok(null);
  } catch (error) {
    return failTheme(error, "renameTheme");
  }
}

export async function deleteTheme(input: ThemeIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("themes.edit", "delete a theme");
  if (!auth.ok) return auth;
  const parsed = theme_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const theme = await getOrFail(parsed.data.id);
    // The store always needs a live theme: publish another one first.
    if (theme.is_live) return fail("theme_live");
    await getBackend().themes.remove(theme.id);
    await log(auth.caller, "delete a theme", theme);
    return ok(null);
  } catch (error) {
    return failTheme(error, "deleteTheme");
  }
}

// Autosave from the editor. The data is validated whole; the store never reads drafts.
export async function saveThemeDraft(input: SaveThemeDraftInput): Promise<ActionResult<{ updated_at: string }>> {
  const auth = await authorize("themes.edit", "edit a theme");
  if (!auth.ok) return auth;
  const parsed = save_theme_draft_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    await getOrFail(parsed.data.id);
    await getBackend().themes.update(parsed.data.id, { draft: parsed.data.data });
    // Not logged: autosave runs every few seconds while typing. Publishing is logged.
    return ok({ updated_at: new Date().toISOString() });
  } catch (error) {
    return failTheme(error, "saveThemeDraft");
  }
}

// The draft becomes the published version and this theme becomes the live one.
export async function publishTheme(input: ThemeIdInput): Promise<ActionResult<{ is_store_refreshed: boolean }>> {
  const auth = await authorize("themes.edit", "publish a theme");
  if (!auth.ok) return auth;
  const parsed = theme_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const theme = await getOrFail(parsed.data.id);
    const data = draftOf(theme, await getLegacyThemeValues());
    const published_at = new Date().toISOString();
    const history: ThemeVersion[] = [{ published_at, data }, ...theme.history].slice(0, HISTORY_SIZE);
    await getBackend().themes.update(theme.id, { published: data, published_at, history });
    await getBackend().themes.setLive(theme.id);
    await log(auth.caller, "publish a theme", theme, { was_live: theme.is_live });
    return ok({ is_store_refreshed: await revalidateStore() });
  } catch (error) {
    return failTheme(error, "publishTheme");
  }
}

// Puts an earlier published version back into the draft (publish to make it live again).
export async function restoreThemeVersion(input: RestoreThemeVersionInput): Promise<ActionResult<null>> {
  const auth = await authorize("themes.edit", "restore a theme version");
  if (!auth.ok) return auth;
  const parsed = restore_theme_version_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const theme = await getOrFail(parsed.data.id);
    const version = theme.history.find((item) => item.published_at === parsed.data.published_at);
    if (!version) return fail("not_found");
    await getBackend().themes.update(theme.id, {
      draft: parseThemeData(version.data, theme.template, await getLegacyThemeValues()),
    });
    await log(auth.caller, "restore a theme version", theme, { published_at: version.published_at });
    return ok(null);
  } catch (error) {
    return failTheme(error, "restoreThemeVersion");
  }
}

// Throws away unpublished changes: the draft goes back to what's published.
export async function discardThemeDraft(input: ThemeIdInput): Promise<ActionResult<null>> {
  const auth = await authorize("themes.edit", "discard theme changes");
  if (!auth.ok) return auth;
  const parsed = theme_id_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const theme = await getOrFail(parsed.data.id);
    if (theme.published === null) return fail("theme_never_published");
    await getBackend().themes.update(theme.id, {
      draft: parseThemeData(theme.published, theme.template, await getLegacyThemeValues()),
    });
    await log(auth.caller, "discard theme changes", theme);
    return ok(null);
  } catch (error) {
    return failTheme(error, "discardThemeDraft");
  }
}
