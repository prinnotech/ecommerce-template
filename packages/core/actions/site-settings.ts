"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { SITE_ASSET_KINDS, type SiteAssetKind } from "@repo/core/lib/schemas/admin";
import { reportError } from "@repo/core/lib/server-log";
import {
  isSettingKey,
  parseSetting,
  SETTING_KEYS,
  SITE_SETTINGS,
  type SettingCategory,
  type SettingInput,
  type SettingKey,
} from "@repo/core/lib/site-settings";

export type SettingEntry = {
  key: SettingKey;
  category: SettingCategory;
  input: SettingInput;
  is_public: boolean;
  value: unknown;
  default_value: unknown;
  is_default: boolean;
  updated_at: string | null;
};

const update_setting_schema = z.object({ key: z.string().max(100), value: z.unknown() });
const reset_setting_schema = z.object({ key: z.string().max(100) });

// Every key in the contract, with its current (validated) value and whether it's still the default.
export async function getAllSettings(): Promise<ActionResult<SettingEntry[]>> {
  const auth = await authorize("settings.view", "view site settings");
  if (!auth.ok) return auth;

  try {
    const rows = await getBackend().settings.list();
    const stored = new Map(rows.map((row) => [row.key, row]));

    return ok(
      SETTING_KEYS.map((key) => {
        const definition = SITE_SETTINGS[key];
        const row = stored.get(key);
        const is_valid = row !== undefined && definition.schema.safeParse(row.value).success;
        return {
          key,
          category: definition.category,
          input: definition.input,
          is_public: definition.is_public,
          value: row ? parseSetting(key, row.value) : definition.default_value,
          default_value: definition.default_value,
          is_default: !is_valid,
          updated_at: row?.updated_at ?? null,
        };
      }),
    );
  } catch (error) {
    return failFrom(error, "site-settings", "getAllSettings");
  }
}

// Changes that affect every page (name, currency, maintenance…) must not wait for revalidation.
function afterSettingChange() {
  revalidatePath("/", "layout");
}

// Backends that send their own emails (PocketBase) show the store name in them.
async function syncStoreName(site_name: string) {
  try {
    await getBackend().settings.syncStoreName(site_name);
  } catch (error) {
    await reportError("site-settings", "syncStoreName", error);
  }
}

export async function updateSetting(input: { key: string; value: unknown }): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "update a site setting");
  if (!auth.ok) return auth;

  const parsed = update_setting_schema.safeParse(input);
  if (!parsed.success || !isSettingKey(parsed.data.key)) return fail("invalid_input");
  const key = parsed.data.key;
  const definition = SITE_SETTINGS[key];
  const value = definition.schema.safeParse(parsed.data.value);
  if (!value.success) return fail("invalid_input");

  try {
    const before = await getBackend().settings.save({
      key,
      category: definition.category,
      value: value.data,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update a site setting",
      target_type: "site_settings",
      target_id: key,
      details: { key, before, after: value.data },
    });
    if (key === "SITE_NAME") await syncStoreName(value.data as string);
    afterSettingChange();
    return ok(null);
  } catch (error) {
    return failFrom(error, "site-settings", `updateSetting ${key}`);
  }
}

// Deletes the stored row, so the contract's default applies again.
export async function resetSetting(input: { key: string }): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "reset a site setting");
  if (!auth.ok) return auth;

  const parsed = reset_setting_schema.safeParse(input);
  if (!parsed.success || !isSettingKey(parsed.data.key)) return fail("invalid_input");
  const key = parsed.data.key;

  try {
    const before = await getBackend().settings.remove(key);
    if (before === undefined) return ok(null);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "reset a site setting",
      target_type: "site_settings",
      target_id: key,
      details: { key, before },
    });
    if (key === "SITE_NAME") await syncStoreName(SITE_SETTINGS.SITE_NAME.default_value);
    afterSettingChange();
    return ok(null);
  } catch (error) {
    return failFrom(error, "site-settings", `resetSetting ${key}`);
  }
}

const ASSET_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

// FormData: kind ("logo" | "favicon"), file. Stores the file and returns its URL; the settings
// screen then saves that URL in the matching setting (with the usual updateSetting checks).
export async function uploadSiteAsset(form_data: FormData): Promise<ActionResult<{ url: string }>> {
  const auth = await authorize("settings.edit", "upload a logo or favicon");
  if (!auth.ok) return auth;

  const kind = form_data.get("kind");
  const file = form_data.get("file");
  if (typeof kind !== "string" || !(SITE_ASSET_KINDS as readonly string[]).includes(kind) || !(file instanceof File)) {
    return fail("invalid_input");
  }
  if (!ASSET_TYPES.includes(file.type)) return fail("invalid_image");
  if (file.size > MAX_ASSET_BYTES) return fail("image_too_large");

  try {
    const url = await getBackend().settings.uploadAsset(kind as SiteAssetKind, file);
    await logActivity({ actor_id: auth.caller.user_id, action: "upload a logo or favicon", details: { kind } });
    return ok({ url });
  } catch (error) {
    return failFrom(error, "site-settings", "uploadSiteAsset");
  }
}
