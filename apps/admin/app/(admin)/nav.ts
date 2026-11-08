import type { Permission } from "@repo/core/lib/permissions";

type NavEntry = { key: string; path: string; permission: Permission };

// Admin sections. The layout shows an entry only if the caller has its permission; each page
// checks the permission again on the server. Icons live in the client sidebar.
export const ADMIN_NAV = [
  { key: "home", path: "/", permission: "dashboard.view" },
  {
    key: "orders",
    path: "/orders",
    permission: "orders.view",
    children: [
      { key: "drafts", path: "/orders/drafts", permission: "draft_orders.view" },
      { key: "abandoned", path: "/orders/abandoned", permission: "orders.view" },
    ],
  },
  {
    key: "products",
    path: "/products",
    permission: "products.view",
    // Shown under Products while the Products section is open (Shopify-style).
    children: [
      { key: "inventory", path: "/products/inventory", permission: "inventory.view" },
      { key: "collections", path: "/collections", permission: "collections.view" },
      { key: "categories", path: "/categories", permission: "categories.view" },
      { key: "gift_cards", path: "/gift-cards", permission: "gift_cards.view" },
      { key: "reviews", path: "/reviews", permission: "reviews.view" },
      { key: "import", path: "/products/import", permission: "products.edit" },
    ],
  },
  { key: "customers", path: "/customers", permission: "customers.view" },
  { key: "analytics", path: "/analytics", permission: "analytics.view" },
  // Marketing → Discounts.
  { key: "discounts", path: "/discounts", permission: "discounts.view" },
  { key: "messages", path: "/messages", permission: "messages.view" },
  // Online store → Themes (the theme editor itself is full-screen, in the (editor) route group).
  {
    key: "themes",
    path: "/themes",
    permission: "themes.view",
    children: [{ key: "pages", path: "/pages", permission: "pages.view" }],
  },
] as const satisfies readonly (NavEntry & { children?: readonly NavEntry[] })[];

// Pinned to the bottom of the sidebar.
export const SETTINGS_NAV = {
  key: "settings",
  path: "/settings",
  permission: "settings.view",
  // Opens the full-screen settings panel (app/(settings)), which has its own section list.
  children: [],
} as const satisfies NavEntry & { children: readonly NavEntry[] };

export type AdminNavKey = (typeof ADMIN_NAV)[number]["key"] | typeof SETTINGS_NAV.key;
export type AdminNavChildKey =
  "drafts" | "abandoned" | "inventory" | "collections" | "gift_cards" | "reviews" | "categories" | "import" | "pages";
