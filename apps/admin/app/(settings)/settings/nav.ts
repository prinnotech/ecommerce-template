import type { Permission } from "@repo/core/lib/permissions";

// The settings panel's left-hand list, grouped like Shopify's. Each entry shows only if the staff
// member may open it; every page checks again on the server.
export type SettingsNavKey =
  | "general"
  | "languages"
  | "domains"
  | "tracking"
  | "payments"
  | "shipping"
  | "taxes"
  | "notifications"
  | "email"
  | "staff"
  | "roles"
  | "activity"
  | "api_keys"
  | "legal"
  | "profile";

export type SettingsNavGroup = {
  key: "store" | "selling" | "customers" | "team" | "legal" | "you";
  items: readonly { key: SettingsNavKey; permission: Permission | null }[];
};

export const SETTINGS_NAV_GROUPS: readonly SettingsNavGroup[] = [
  {
    key: "store",
    items: [
      { key: "general", permission: "settings.view" },
      { key: "languages", permission: "settings.view" },
      { key: "domains", permission: "settings.view" },
      { key: "tracking", permission: "settings.view" },
    ],
  },
  {
    key: "selling",
    items: [
      { key: "payments", permission: "settings.view" },
      { key: "shipping", permission: "settings.view" },
      { key: "taxes", permission: "settings.view" },
    ],
  },
  {
    key: "customers",
    items: [
      { key: "notifications", permission: "settings.view" },
      { key: "email", permission: "settings.view" },
    ],
  },
  {
    key: "team",
    items: [
      { key: "staff", permission: "users.view" },
      { key: "roles", permission: "roles.view" },
      { key: "activity", permission: "audit.view" },
      { key: "api_keys", permission: "api_keys.view" },
    ],
  },
  { key: "legal", items: [{ key: "legal", permission: "settings.view" }] },
  // Everyone can edit their own profile.
  { key: "you", items: [{ key: "profile", permission: null }] },
];
