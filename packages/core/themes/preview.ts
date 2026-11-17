// Messages between the theme editor (admin) and its preview iframe (store). Both sides check the
// other's origin before acting on a message.

// Editor → preview, after each autosave: re-render from the new draft.
export const PREVIEW_REFRESH_MESSAGE = "theme-preview:refresh";

// Editor → preview: scroll to a section and mark it selected (id "" clears the mark), and the
// names to show when a section is hovered (section id → label).
export type PreviewFocusMessage = { type: "theme-preview:focus"; id: string };
export type PreviewLabelsMessage = { type: "theme-preview:labels"; labels: Record<string, string> };
// Preview → editor: a section was clicked; "ready" after each (re)load, so the editor sends the
// labels and the selection again.
export type PreviewSelectMessage = { type: "theme-preview:select"; id: string };
export type PreviewReadyMessage = { type: "theme-preview:ready" };

export type EditorToPreviewMessage = PreviewFocusMessage | PreviewLabelsMessage;
export type PreviewToEditorMessage = PreviewSelectMessage | PreviewReadyMessage;

// The attribute that marks a section in the preview (value = the section id, or "header" /
// "announcement" / "footer" for the header and footer groups).
export const PREVIEW_SECTION_ATTRIBUTE = "data-theme-section";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readEditorMessage(data: unknown): EditorToPreviewMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === "theme-preview:focus" && typeof data.id === "string") return { type: data.type, id: data.id };
  if (data.type === "theme-preview:labels" && isRecord(data.labels)) {
    const labels: Record<string, string> = {};
    for (const [key, value] of Object.entries(data.labels)) if (typeof value === "string") labels[key] = value;
    return { type: data.type, labels };
  }
  return null;
}

export function readPreviewMessage(data: unknown): PreviewToEditorMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === "theme-preview:select" && typeof data.id === "string") return { type: data.type, id: data.id };
  if (data.type === "theme-preview:ready") return { type: data.type };
  return null;
}

// The store page that shows a theme's draft; the token comes from the admin's getTheme().
export function previewPath(lang: string, token: string, page = "home"): string {
  return `/${lang}/theme-preview/${encodeURIComponent(token)}?page=${encodeURIComponent(page)}`;
}
