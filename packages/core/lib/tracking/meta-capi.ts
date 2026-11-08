import "server-only";

import { createHash } from "node:crypto";

import { getSecret } from "@repo/core/lib/secrets";
import { reportError } from "@repo/core/lib/server-log";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import type { MetaEventName } from "@repo/core/lib/tracking/meta-capi-types";

// Meta Conversions API: the server copy of a Pixel event. Browser and server send the same
// event_id, so Meta counts it once (and still counts it if an ad blocker stops the Pixel).

const GRAPH_VERSION = "v23.0";

export { META_EVENTS, type MetaEventName } from "@repo/core/lib/tracking/meta-capi-types";

export type MetaEvent = {
  event_name: MetaEventName;
  event_id: string;
  event_source_url: string;
  user: {
    email?: string;
    phone?: string;
    external_id?: string;
    client_ip?: string;
    user_agent?: string;
    fbp?: string;
    fbc?: string;
    country?: string;
  };
  custom_data?: Record<string, unknown>;
};

// Meta wants personal data normalized and SHA-256 hashed.
function hash(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? createHash("sha256").update(normalized).digest("hex") : undefined;
}

export async function isMetaCapiReady(): Promise<boolean> {
  const [tracking, token] = await Promise.all([getSiteSetting("TRACKING"), getSecret("META_CAPI_TOKEN")]);
  return Boolean(tracking.meta_pixel_id && token);
}

// Never throws: tracking must not break a checkout or a webhook.
export async function sendMetaEvent(event: MetaEvent): Promise<boolean> {
  try {
    const [tracking, token] = await Promise.all([getSiteSetting("TRACKING"), getSecret("META_CAPI_TOKEN")]);
    if (!tracking.meta_pixel_id || !token) return false;
    const { user } = event;
    const body = {
      data: [
        {
          event_name: event.event_name,
          event_id: event.event_id,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: event.event_source_url,
          user_data: {
            em: hash(user.email),
            ph: hash(user.phone?.replace(/[^\d]/g, "")),
            external_id: hash(user.external_id),
            country: hash(user.country),
            client_ip_address: user.client_ip || undefined,
            client_user_agent: user.user_agent || undefined,
            fbp: user.fbp || undefined,
            fbc: user.fbc || undefined,
          },
          custom_data: event.custom_data,
        },
      ],
    };
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${tracking.meta_pixel_id}/events?access_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!response.ok) {
      await reportError("tracking", `Meta CAPI ${event.event_name}`, new Error(`HTTP ${response.status}`));
      return false;
    }
    return true;
  } catch (error) {
    await reportError("tracking", `Meta CAPI ${event.event_name}`, error);
    return false;
  }
}
