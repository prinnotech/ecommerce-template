import "server-only";

import { cache } from "react";

import { getBackend } from "@repo/core/backend/index";
import { localized_text_schema } from "@repo/core/lib/localized";
import { id_schema } from "@repo/core/lib/schemas/ids";
import type { ThemeData, ThemeSection } from "@repo/core/lib/schemas/theme";
import { reportError } from "@repo/core/lib/server-log";
import { verifyPreviewToken } from "@repo/core/lib/theme-signing";
import {
  DEFAULT_TEMPLATE,
  parsePageSections,
  parseThemeData,
  templateData,
  withLegacyValues,
  type LegacyThemeValues,
} from "@repo/core/themes/index";

// Settings that moved into themes (page templates): their stored value still seeds themes saved
// before that, and the default theme of a store without one. Read raw, since they're no longer in
// the settings contract.
export const getLegacyThemeValues = cache(async (): Promise<LegacyThemeValues> => {
  try {
    const rows = await getBackend().settings.list();
    const about = localized_text_schema.safeParse(rows.find((row) => row.key === "ABOUT_CONTENT")?.value);
    return { about_text: about.success ? about.data : undefined };
  } catch (error) {
    await reportError("themes", "getLegacyThemeValues", error);
    return {};
  }
});

export async function defaultThemeData(): Promise<ThemeData> {
  return withLegacyValues(templateData(DEFAULT_TEMPLATE.id), await getLegacyThemeValues());
}

// The store's live theme, once per request. No live theme (fresh install, nothing published yet)
// = the default template, so the store always renders.
export const getLiveTheme = cache(async (): Promise<ThemeData> => {
  try {
    const live = await getBackend().themes.getLive();
    if (!live || live.published === null) return defaultThemeData();
    return parseThemeData(live.published, live.template, await getLegacyThemeValues());
  } catch (error) {
    await reportError("themes", "getLiveTheme", error);
    return templateData(DEFAULT_TEMPLATE.id);
  }
});

// The theme preview: a theme's draft, only for a valid preview token. null = show "not found".
export async function getPreviewTheme(token: string): Promise<ThemeData | null> {
  const theme_id = verifyPreviewToken(token);
  if (!theme_id) return null;
  const theme = await getBackend().themes.get(theme_id);
  return theme ? parseThemeData(theme.draft, theme.template, await getLegacyThemeValues()) : null;
}

// The theme preview of a custom page, hidden ones included (same token as the theme's draft).
export async function getPreviewPageSections(token: string, page_id: string): Promise<ThemeSection[] | null> {
  if (!verifyPreviewToken(token) || !id_schema.safeParse(page_id).success) return null;
  const page = await getBackend().pages.get(page_id);
  return page ? parsePageSections(page.sections) : null;
}
