import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(on_change: () => void) {
  const media_query = window.matchMedia(QUERY);
  media_query.addEventListener("change", on_change);
  return () => media_query.removeEventListener("change", on_change);
}

// Used by the shadcn sidebar. useSyncExternalStore avoids a setState-in-effect re-render.
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
