import type { NextRequest, NextResponse } from "next/server";

import { mergeTouch, paramsFromUrl, parseAttribution } from "@repo/core/lib/tracking/attribution";
import { FBC_COOKIE, TRACKING_COOKIE, TRACKING_COOKIE_DAYS } from "@repo/core/lib/tracking/tracking-params";

// Proxy step (store): ad params in the URL are merged into the "utm" cookie. Not on /auth pages.
// Loaded by proxy.ts, so no server-only imports.
export function captureTracking(request: NextRequest, response: NextResponse): void {
  const url = request.nextUrl;
  if (/^\/(?:[a-z]{2}\/)?auth(?:\/|$)/.test(url.pathname)) return;
  const params = paramsFromUrl(url);
  if (Object.keys(params).length === 0) return;

  const existing = parseAttribution(request.cookies.get(TRACKING_COOKIE)?.value ?? "");
  const merged = mergeTouch(existing, params, {
    landing_page: `${url.pathname}${url.search}`,
    referrer: request.headers.get("referer") ?? "",
    now: new Date().toISOString(),
  });
  const cookie = { path: "/", sameSite: "lax" as const, secure: url.protocol === "https:" };
  response.cookies.set(TRACKING_COOKIE, JSON.stringify(merged), {
    ...cookie,
    maxAge: TRACKING_COOKIE_DAYS * 24 * 60 * 60,
    httpOnly: true,
  });
  // Meta's click cookie, in the format its Pixel and Conversions API expect.
  if (params.fbclid && !request.cookies.get(FBC_COOKIE)?.value.endsWith(`.${params.fbclid}`)) {
    response.cookies.set(FBC_COOKIE, `fb.1.${Date.now()}.${params.fbclid}`, { ...cookie, maxAge: 90 * 24 * 60 * 60 });
  }
}
