import { z } from "zod";

import { TRACKING_PARAMS } from "@repo/core/lib/tracking/tracking-params";

// Where a visitor came from, kept in the "utm" cookie for 90 days and saved on their order.
// Last touch wins per key; landing_page, referrer and first_seen_at stay from the first visit.

const value_schema = z.string().max(500);

export const attribution_schema = z
  .object({
    landing_page: value_schema,
    referrer: value_schema,
    first_seen_at: value_schema,
    last_seen_at: value_schema,
  })
  .partial()
  .catchall(value_schema);
export type Attribution = z.infer<typeof attribution_schema>;

export function parseAttribution(value: unknown): Attribution {
  if (typeof value === "string") {
    try {
      return parseAttribution(JSON.parse(value));
    } catch {
      // A broken cookie is ignored (it's rewritten on the next ad click).
      return {};
    }
  }
  const parsed = attribution_schema.safeParse(value);
  if (!parsed.success) return {};
  // Only known keys: the cookie is written by us, but anything can arrive in a request.
  const known = new Set<string>(["landing_page", "referrer", "first_seen_at", "last_seen_at", ...TRACKING_PARAMS]);
  return Object.fromEntries(Object.entries(parsed.data).filter(([key]) => known.has(key)));
}

// The tracking params in a URL, including bundled ?ads= / ?adsMetadata= JSON.
export function paramsFromUrl(url: URL): Partial<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const key of TRACKING_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) found[key] = value.slice(0, 500);
  }
  for (const bundle of ["ads", "adsMetadata"]) {
    const raw = url.searchParams.get(bundle);
    if (!raw) continue;
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data !== "object" || data === null) continue;
      for (const [key, value] of Object.entries(data)) {
        if ((TRACKING_PARAMS as readonly string[]).includes(key) && typeof value === "string" && value) {
          found[key] = value.slice(0, 500);
        }
      }
    } catch {
      // Not JSON: ignored.
    }
  }
  return found;
}

export function mergeTouch(
  existing: Attribution,
  params: Partial<Record<string, string>>,
  visit: { landing_page: string; referrer: string; now: string },
): Attribution {
  return {
    ...existing,
    ...params,
    landing_page: existing.landing_page || visit.landing_page.slice(0, 500),
    referrer: existing.referrer || visit.referrer.slice(0, 500),
    first_seen_at: existing.first_seen_at || visit.now,
    last_seen_at: visit.now,
  };
}

// The keys worth showing on an order ("Google / cpc / summer-sale").
export function attributionSummary(attribution: Attribution | null): {
  source: string;
  medium: string;
  campaign: string;
} {
  const value = attribution ?? {};
  const click =
    (value.gclid || value.gbraid || value.wbraid ? "google" : "") ||
    (value.fbclid ? "meta" : "") ||
    (value.ttclid ? "tiktok" : "") ||
    (value.msclkid ? "microsoft" : "");
  return {
    source: value.utm_source || click,
    medium: value.utm_medium || (click ? "cpc" : ""),
    campaign: value.utm_campaign || "",
  };
}
