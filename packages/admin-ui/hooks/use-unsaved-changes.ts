"use client";

import { useEffect } from "react";

// While a form has unsaved changes: the browser asks before closing or reloading the tab, and
// in-app links ask before leaving (App Router has no navigation event to block, so link clicks
// are checked in the capture phase).
export function useUnsavedChanges(is_dirty: boolean, leave_warning: string) {
  useEffect(() => {
    if (!is_dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      if (anchor.origin !== window.location.origin) return;
      if (!window.confirm(leave_warning)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [is_dirty, leave_warning]);
}
