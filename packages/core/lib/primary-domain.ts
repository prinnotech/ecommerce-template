import { NextResponse, type NextRequest } from "next/server";

// Proxy helper (no "server-only": the proxy can't load it). When the app has a primary domain
// (Settings → Domains), every other public hostname answers with a 301 to the same path on it.

// Hosts that must keep answering as they are: local development, IP addresses, the hosts'
// internal names and health checks, and the default when nothing tells us the host.
function isExempt(host: string): boolean {
  return (
    host === "" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "healthcheck.railway.app" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.includes(":") // an IPv6 literal (the port is stripped before)
  );
}

function requestHost(request: NextRequest): string {
  // Behind the host's proxy the original hostname is in x-forwarded-host.
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const first = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("[") ? first : first.replace(/:\d+$/, "");
}

export function primaryDomainRedirect(request: NextRequest, primary: string): NextResponse | null {
  // Preview deployments keep their own address, or every preview would jump to production.
  if (!primary || process.env.VERCEL_ENV === "preview") return null;
  const host = requestHost(request);
  if (host === primary || isExempt(host)) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = primary;
  url.port = "";
  return NextResponse.redirect(url, 301);
}
