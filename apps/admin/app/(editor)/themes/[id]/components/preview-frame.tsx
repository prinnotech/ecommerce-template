"use client";

import { EyeOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { AdminDictionary } from "@repo/core/lib/i18n";
import { PREVIEW_REFRESH_MESSAGE, previewPath } from "@repo/core/themes/preview";
import { cn } from "@repo/ui/lib/utils";

type PreviewFrameProps = {
  store_url: string;
  // null = THEME_PREVIEW_SECRET isn't set: explain instead of showing a broken frame.
  token: string | null;
  lang: string;
  device: "desktop" | "mobile";
  // Goes up after every autosave; the store page then re-renders from the new draft.
  refresh_count: number;
  // Which page the preview shows: a theme page, or "page:<id>" for a custom page.
  page: string;
  dictionary: AdminDictionary["themes"]["editor"];
};

export function PreviewFrame({ store_url, token, lang, device, refresh_count, page, dictionary }: PreviewFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const store_origin = new URL(store_url).origin;

  // Tell the store page (another app) to reload the draft; it ignores messages from elsewhere.
  useEffect(() => {
    if (refresh_count === 0) return;
    frame.current?.contentWindow?.postMessage(PREVIEW_REFRESH_MESSAGE, store_origin);
  }, [refresh_count, store_origin]);

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
