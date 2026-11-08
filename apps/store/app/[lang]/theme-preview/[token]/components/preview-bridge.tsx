"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PREVIEW_REFRESH_MESSAGE } from "@repo/core/themes/preview";

// Inside the editor's iframe:
// - the editor posts "refresh" after each autosave, and the page re-renders from the new draft
//   without reloading (the scroll position stays);
// - links and forms do nothing, so the preview stays on the draft and never signs anyone up.
export function PreviewBridge({ admin_origin }: { admin_origin: string }) {
  const router = useRouter();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== admin_origin) return;
      if (event.data === PREVIEW_REFRESH_MESSAGE) router.refresh();
    }
    function onClick(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
    }
    function onSubmit(event: SubmitEvent) {
      event.preventDefault();
    }
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [admin_origin, router]);

  return null;
}
