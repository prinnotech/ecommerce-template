"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity-log";
import { authorize } from "@/lib/auth";
import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { reportError } from "@/lib/server-log";
import {
  isSettingKey,
  parseSetting,
  SETTING_KEYS,
  SITE_SETTINGS,
  type SettingCategory,
  type SettingInput,
  type SettingKey,
} from "@/lib/site-settings";

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
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("site_settings").getFullList({ fields: "key,value,updated_at" });
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
    await reportError("site-settings", "getAllSettings", error);
    return fail("generic");
  }
}

// Changes that affect every page (name, currency, maintenance…) must not wait for revalidation.
function afterSettingChange() {
  revalidatePath("/", "layout");
}

// PocketBase uses its own app name in auth emails ({APP_NAME}); keep it equal to SITE_NAME.
async function syncPocketBaseAppName(site_name: string) {
  try {
    const pb = await createAdminPocketBase();
    await pb.settings.update({ meta: { appName: site_name } });
  } catch (error) {
    await reportError("site-settings", "sync PocketBase appName", error);
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
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("site_settings")
      .getFirstListItem(pb.filter("key = {:key}", { key }), { fields: "id,value" })
      .catch(() => null);

    const row = {
      key,
      category: definition.category,
      value: value.data,
      is_public: definition.is_public,
      updated_by: auth.caller.user_id,
    };
    if (existing) await pb.collection("site_settings").update(existing.id, row);
    else await pb.collection("site_settings").create(row);

    await logActivity({
      actor_id: auth.caller.user_id,
      action: "update a site setting",
      target_type: "site_settings",
      target_id: key,
      details: { key, before: existing?.value ?? null, after: value.data },
    });
    if (key === "SITE_NAME") await syncPocketBaseAppName(value.data as string);
    afterSettingChange();
    return ok(null);
  } catch (error) {
    await reportError("site-settings", `updateSetting ${key}`, error);
    return fail("generic");
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
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("site_settings")
      .getFirstListItem(pb.filter("key = {:key}", { key }), { fields: "id,value" })
      .catch(() => null);
    if (!existing) return ok(null);

    await pb.collection("site_settings").delete(existing.id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "reset a site setting",
      target_type: "site_settings",
      target_id: key,
      details: { key, before: existing.value },
    });
    if (key === "SITE_NAME") await syncPocketBaseAppName(SITE_SETTINGS.SITE_NAME.default_value);
    afterSettingChange();
    return ok(null);
  } catch (error) {
    await reportError("site-settings", `resetSetting ${key}`, error);
    return fail("generic");
  }
}
