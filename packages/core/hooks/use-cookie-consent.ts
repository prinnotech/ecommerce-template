"use client";

import { useSyncExternalStore } from "react";

import { parseConsent, type Consent } from "@repo/core/lib/tracking/consent";
import { CONSENT_COOKIE, CONSENT_COOKIE_DAYS } from "@repo/core/lib/tracking/tracking-params";

// The cookie banner's choice, read from the cookie (the server reads the same cookie). On the
// server and during hydration it's "unknown", so nothing renders differently before hydration.

const listeners = new Set<() => void>();

function readCookie(): string {
  const prefix = `${CONSENT_COOKIE}=`;
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? ""
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveCookieConsent(choice: Omit<Consent, "at">): void {
  const value = encodeURIComponent(JSON.stringify({ ...choice, at: new Date().toISOString() }));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_COOKIE_DAYS * 24 * 60 * 60}; SameSite=Lax${secure}`;
  for (const listener of listeners) listener();
}

// undefined = not known yet (server, hydration); null = not chosen; else the choice.
export function useCookieConsent(): Consent | null | undefined {
  const raw = useSyncExternalStore(subscribe, readCookie, () => undefined);
  return raw === undefined ? undefined : parseConsent(raw);
}
