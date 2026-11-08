import { cookies, headers } from "next/headers";
import { z } from "zod";

import { getClientIp, isRateLimited } from "@repo/core/lib/rate-limit";
import { parseConsent } from "@repo/core/lib/tracking/consent";
import { META_EVENTS, sendMetaEvent } from "@repo/core/lib/tracking/meta-capi";
import { CONSENT_COOKIE, FBC_COOKIE, FBP_COOKIE } from "@repo/core/lib/tracking/tracking-params";

// The Conversions API copy of a browser Pixel event (lib/tracking/browser.ts). A route handler, not an
// action, on purpose: actions run one at a time per visitor and tracking mustn't delay real ones.

const body_schema = z.object({
  event_name: z.enum(META_EVENTS),
  event_id: z.string().min(1).max(100),
  event_source_url: z.url().max(1000),
  custom_data: z
    .record(
      z.string().max(40),
      z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(100)).max(50)]),
    )
    .optional(),
});

export async function POST(request: Request) {
  const cookie_store = await cookies();
  // No marketing consent: nothing is sent (the Pixel isn't loaded either).
  if (!parseConsent(cookie_store.get(CONSENT_COOKIE)?.value)?.marketing) return new Response(null, { status: 204 });

  const ip = await getClientIp();
  if (isRateLimited(`meta_capi:${ip}`, 120, 60_000)) return new Response(null, { status: 429 });

  const parsed = body_schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });

  const header_store = await headers();
  await sendMetaEvent({
    ...parsed.data,
    user: {
      client_ip: ip,
      user_agent: header_store.get("user-agent") ?? "",
      fbp: cookie_store.get(FBP_COOKIE)?.value,
      fbc: cookie_store.get(FBC_COOKIE)?.value,
    },
  });
  return new Response(null, { status: 204 });
}
