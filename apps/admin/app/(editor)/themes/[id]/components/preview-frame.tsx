"use client";

import { EyeOffIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";

import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  PREVIEW_REFRESH_MESSAGE,
  previewPath,
  readPreviewMessage,
  type EditorToPreviewMessage,
} from "@repo/core/themes/preview";
import { cn } from "@repo/ui/lib/utils";

type PreviewFrameProps = {
  store_url: string;
  // null = no preview signing secret: explain instead of showing a broken frame.
  token: string | null;
  lang: string;
  device: "desktop" | "mobile";
  // Goes up after every autosave; the store page then re-renders from the new draft.
  refresh_count: number;
  // Which page the preview shows: a theme page, or "page:<id>" for a custom page.
  page: string;
  // The section selected in the sidebar ("" = none): outlined and scrolled to in the preview.
  selected_id: string;
  // Section id → name, shown when a section is hovered in the preview.
  labels: Record<string, string>;
  // A section was clicked in the preview.
  onSelect: (id: string) => void;
  dictionary: AdminDictionary["themes"]["editor"];
};

export function PreviewFrame({
  store_url,
  token,
  lang,
  device,
  refresh_count,
  page,
  selected_id,
  labels,
  onSelect,
  dictionary,
}: PreviewFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const store_origin = new URL(store_url).origin;
  const labels_key = JSON.stringify(labels);

  const post = (message: EditorToPreviewMessage | typeof PREVIEW_REFRESH_MESSAGE) =>
    frame.current?.contentWindow?.postMessage(message, store_origin);

  // The store page (another app) ignores messages from anywhere but the admin, and this side
  // ignores messages from anywhere but the store.
  const onPreviewMessage = useEffectEvent((event: MessageEvent) => {
    if (event.origin !== store_origin || event.source !== frame.current?.contentWindow) return;
    const message = readPreviewMessage(event.data);
    if (message?.type === "theme-preview:select") onSelect(message.id);
    if (message?.type === "theme-preview:ready") {
      post({ type: "theme-preview:labels", labels });
      post({ type: "theme-preview:focus", id: selected_id });
    }
  });

  useEffect(() => {
    window.addEventListener("message", onPreviewMessage);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, []);

  useEffect(() => {
    if (refresh_count > 0) frame.current?.contentWindow?.postMessage(PREVIEW_REFRESH_MESSAGE, store_origin);
  }, [refresh_count, store_origin]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "theme-preview:focus", id: selected_id }, store_origin);
  }, [selected_id, store_origin]);

  const sendLabels = useEffectEvent(() => post({ type: "theme-preview:labels", labels }));
  // Keyed on the labels' content: the parent builds a new object on every render.
  useEffect(() => {
    sendLabels();
  }, [labels_key]);

  if (!token) {
    return (
      <div className="m-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <EyeOffIcon className="text-muted-foreground size-8" strokeWidth={1.5} aria-hidden />
        <p className="font-medium">{dictionary.preview_off_title}</p>
        <p className="text-muted-foreground text-sm">{dictionary.preview_off_body}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
      <iframe
        ref={frame}
        title={dictionary.preview_label}
        src={`${store_url}${previewPath(lang, token, page)}`}
        className={cn(
          "bg-background h-full rounded-lg border shadow-sm transition-[width] duration-300",
          device === "mobile" ? "w-[390px]" : "w-full",
        )}
      />
    </div>
  );
}
