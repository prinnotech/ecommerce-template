import "server-only";

import { cache } from "react";

import { getBackend } from "@repo/core/backend/index";
import { reportError } from "@repo/core/lib/server-log";
import {
  buildSettings,
  defaultSettings,
  type SettingKey,
  type SettingValue,
  type SiteSettings,
} from "@repo/core/lib/site-settings";

// One query per request. Non-public keys are read here too: this is trusted config,
// never caller-scoped data, and every value is validated per key.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    return buildSettings(await getBackend().settings.list());
  } catch (error) {
    // A fresh project or an unreachable database still renders with defaults.
    await reportError("site-settings", "getSiteSettings", error);
    return defaultSettings();
  }
});

export async function getSiteSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  return (await getSiteSettings())[key];
}
