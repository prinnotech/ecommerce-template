"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

// Index-table state (view, search, filters, sort, page) lives in the URL, so a filtered list can be
// bookmarked, shared and survives a refresh. Values equal to their default are left out of the URL.
// Components using this need a <Suspense> boundary (useSearchParams).
export function useUrlState<State extends Record<string, string>>(defaults: State) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const [is_pending, startTransition] = useTransition();

  const state = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, search_params.get(key) ?? fallback]),
  ) as State;

  // Changing anything but the page goes back to page 1.
  function update(patch: Partial<State>) {
    const next = { ...state, ...patch };
    if (!("page" in patch) && "page" in defaults) (next as Record<string, string>).page = defaults.page ?? "1";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== defaults[key]) params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return { state, update, is_pending };
}
