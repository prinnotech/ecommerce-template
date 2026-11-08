"use server";

import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { canStoreSecrets, saveSecret, secretStatus, type SecretStatus } from "@repo/core/lib/secrets";
import { SITE_SETTINGS, tracking_schema, type TrackingSettings } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

// Settings → Tracking: the tag ids (a public setting) and the Meta Conversions API token (secret).

export type TrackingOverview = {
  tracking: TrackingSettings;
  capi_token: SecretStatus;
  can_store_secrets: boolean;
};

export async function getTracking(): Promise<ActionResult<TrackingOverview>> {
  const auth = await authorize("settings.view", "view tracking settings");
  if (!auth.ok) return auth;
  try {
    const [settings, secrets] = await Promise.all([getSiteSettings(), secretStatus()]);
    return ok({
      tracking: settings.TRACKING,
      capi_token: secrets.META_CAPI_TOKEN,
      can_store_secrets: canStoreSecrets(),
    });
  } catch (error) {
    return failFrom(error, "tracking", "getTracking");
  }
}

const save_tracking_schema = z.object({
  tracking: tracking_schema,
  // undefined = keep the saved token; "" = remove it.
  capi_token: z.string().trim().max(1000).optional(),
});
export type SaveTrackingInput = z.input<typeof save_tracking_schema>;

export async function saveTracking(input: SaveTrackingInput): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "change the tracking settings");
  if (!auth.ok) return auth;
  const parsed = save_tracking_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  if (parsed.data.capi_token && !canStoreSecrets()) return fail("secrets_unavailable");

  try {
    const definition = SITE_SETTINGS.TRACKING;
    await getBackend().settings.save({
      key: "TRACKING",
      category: definition.category,
      value: parsed.data.tracking,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    if (parsed.data.capi_token !== undefined) {
      await saveSecret("META_CAPI_TOKEN", parsed.data.capi_token, auth.caller.user_id);
    }
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the tracking settings",
      target_type: "settings",
      details: { ...parsed.data.tracking, capi_token_changed: parsed.data.capi_token !== undefined },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "tracking", "saveTracking");
  }
}
