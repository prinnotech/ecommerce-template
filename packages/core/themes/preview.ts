// Sent by the theme editor (admin) to the preview iframe (store) after each autosave.
export const PREVIEW_REFRESH_MESSAGE = "theme-preview:refresh";

// The store page that shows a theme's draft; the token comes from the admin's getTheme().
export function previewPath(lang: string, token: string, page = "home"): string {
  return `/${lang}/theme-preview/${encodeURIComponent(token)}?page=${encodeURIComponent(page)}`;
}
