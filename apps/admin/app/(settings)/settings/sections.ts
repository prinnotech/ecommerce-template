import type { SettingCategory } from "@repo/core/lib/site-settings";

export type SettingsSectionKey = "general" | "languages" | "shipping" | "taxes" | "legal";

export type SettingsSection = { key: SettingsSectionKey; categories: readonly SettingCategory[] };

// Settings sections built from setting categories (the [section] page). Payments, notifications
// and email sending have their own screens. "general" also groups contact + storefront.
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { key: "general", categories: ["general", "contact", "storefront"] },
  { key: "languages", categories: ["localization"] },
  { key: "shipping", categories: ["shipping"] },
  { key: "taxes", categories: ["taxes"] },
  { key: "legal", categories: ["content"] },
];

export function sectionForKey(key: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.key === key);
}
