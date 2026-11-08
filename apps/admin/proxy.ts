import { NextResponse, type NextRequest } from "next/server";

import { LOCALES } from "@repo/core/i18nConfig";
import { hasSessionCookie, updateSession } from "@repo/core/backend/proxy";
import { primaryDomainRedirect } from "@repo/core/lib/primary-domain";
import { getProxySetting } from "@repo/core/lib/site-settings-proxy";

// Must match ADMIN_PATH_HEADER in lib/auth.ts (not imported: that module is server-only).
const ADMIN_PATH_HEADER = "x-admin-path";

// The admin has no language in its URLs (the language is a staff preference, lib/admin-locale.ts).
// 0. Primary domain (Settings → Domains): other public hostnames get a 301 to it.
// 1. Old links (/en/dashboard/orders, /it/auth/login) redirect to the clean URL.
// 2. The requested path is passed to the auth guard, so sign-in can return to it.
// 3. Session refresh, only when an auth cookie exists. No permission decisions here.
export async function proxy(request: NextRequest) {
  const redirect = primaryDomainRedirect(request, await getProxySetting("PRIMARY_DOMAIN_ADMIN"));
  if (redirect) return redirect;

  const legacy_path = cleanLegacyPath(request.nextUrl.pathname);
  if (legacy_path !== null) {
    const url = request.nextUrl.clone();
    url.pathname = legacy_path;
    return NextResponse.redirect(url, 308);
  }

  const request_headers = new Headers(request.headers);
  request_headers.set(ADMIN_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.next({ request: { headers: request_headers } });

  if (hasSessionCookie(request)) await updateSession(request, response);

  return response;
}

// "/en/dashboard/orders" → "/orders", "/it/auth/login" → "/login", "/es" → "/". null = not a legacy URL.
function cleanLegacyPath(pathname: string): string | null {
  const [, first = "", ...rest] = pathname.split("/");
  if (!(LOCALES as readonly string[]).includes(first)) return null;
  const tail = rest.join("/");
  if (tail.startsWith("dashboard")) return `/${tail.slice("dashboard".length).replace(/^\//, "")}`;
  if (tail.startsWith("auth/")) return `/${tail.slice("auth/".length)}`;
  return `/${tail}`;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|media|favicon.ico|robots.txt|.*\\..*).*)"],
};
