import type { Permission } from "@/lib/permissions";

// Dashboard sections. The layout shows an entry only if the caller has its permission;
// each page checks the permission again on the server. Icons live in the client sidebar.
export const DASHBOARD_NAV = [
  { key: "home", path: "", permission: "dashboard.view" },
  { key: "orders", path: "/orders", permission: "orders.view" },
  { key: "products", path: "/products", permission: "products.view" },
  { key: "categories", path: "/categories", permission: "categories.edit" },
  { key: "messages", path: "/messages", permission: "messages.view" },
  { key: "settings", path: "/settings", permission: "settings.view" },
] as const satisfies readonly { key: string; path: string; permission: Permission }[];

export type DashboardNavKey = (typeof DASHBOARD_NAV)[number]["key"];
