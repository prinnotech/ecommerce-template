// Browser-side tracking events. Each helper does nothing when its tag isn't loaded (no consent,
// or no id in Settings → Tracking), so pages can call them unconditionally.
//
// Meta events go to the Pixel AND to /api/tracking/meta (Conversions API) with the same event_id.

import type { MetaEventName } from "@repo/core/lib/tracking/meta-capi-types";

type Fbq = (command: string, ...args: unknown[]) => void;
type Gtag = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

export function newEventId(): string {
  return crypto.randomUUID();
}

export function trackMetaEvent(
  event_name: MetaEventName,
  custom_data: Record<string, string | number | boolean | string[]> = {},
  event_id = newEventId(),
): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event_name, custom_data, { eventID: event_id });
  void fetch("/api/tracking/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ event_name, event_id, event_source_url: window.location.href, custom_data }),
  }).catch(() => undefined);
}

export function trackGoogleEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", name, params);
  else window.dataLayer?.push({ event: name, ...params });
}

export function trackGoogleAdsConversion(conversion: {
  send_to: string;
  value: number;
  currency: string;
  transaction_id: string;
}): void {
  if (typeof window === "undefined" || !window.gtag || !conversion.send_to) return;
  window.gtag("event", "conversion", conversion);
}

export function trackPageView(): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "PageView");
  trackGoogleEvent("page_view", { page_location: window.location.href, page_title: document.title });
}
