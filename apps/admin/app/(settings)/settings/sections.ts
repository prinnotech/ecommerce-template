import type { SettingCategory } from "@repo/core/lib/site-settings";

export type SettingsSectionKey = "general" | "shipping" | "taxes" | "legal";

export type SettingsSection = { key: SettingsSectionKey; categories: readonly SettingCategory[] };

// Settings sections built from setting categories (the [section] page). Payments, notifications
// and email sending have their own screens. "general" also groups contact + storefront.
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  // Languages and AI have their own screens.
  { key: "general", categories: ["general", "contact", "storefront", "localization"] },
  { key: "shipping", categories: ["shipping"] },
  { key: "taxes", categories: ["taxes"] },
  { key: "legal", categories: ["content"] },
];

export function sectionForKey(key: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.key === key);
}
