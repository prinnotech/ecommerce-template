import "server-only";

import { cache } from "react";

import { createAdminPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { reportError } from "@/lib/server-log";
import {
  buildSettings,
  defaultSettings,
  type SettingKey,
  type SettingValue,
  type SiteSettings,
} from "@/lib/site-settings";

// One query per request. Uses the superuser client because non-public keys are read
// here too; this is trusted config, never caller-scoped data, and it is validated per key.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("site_settings").getFullList({ fields: "key,value" });
    return buildSettings(rows);
  } catch (error) {
    // A fresh project or an unreachable database still renders with defaults.
    await reportError("site-settings", "getSiteSettings", error);
    return defaultSettings();
  }
});

export async function getSiteSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  return (await getSiteSettings())[key];
}
