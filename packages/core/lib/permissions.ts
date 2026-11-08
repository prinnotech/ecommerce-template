// Permission catalog. A key is `group.action`. Labels live under
// dictionary.permissions.<group>.<action> (added with the Roles screen).
export const PERMISSION_GROUPS = {
  dashboard: ["view"],
  analytics: ["view"],
  products: ["view", "edit"],
  inventory: ["view", "edit"],
  categories: ["view", "edit"],
  collections: ["view", "edit"],
  gift_cards: ["view", "edit"],
  reviews: ["view", "edit"],
  orders: ["view", "edit", "refund"],
  draft_orders: ["view", "edit"],
  discounts: ["view", "edit"],
  customers: ["view", "edit"],
  messages: ["view"],
  settings: ["view", "edit"],
  themes: ["view", "edit"],
  pages: ["view", "edit"],
  users: ["view", "invite", "edit", "deactivate"],
  roles: ["view", "edit"],
  audit: ["view"],
  api_keys: ["view", "edit"],
} as const;

type PermissionGroups = typeof PERMISSION_GROUPS;

export type Permission = {
  [G in keyof PermissionGroups]: `${G}.${PermissionGroups[G][number]}`;
}[keyof PermissionGroups];

// Grants every permission. Only admins can assign it.
export const SUPER_ADMIN = "isSuperAdmin";

export type RolePermission = Permission | typeof SUPER_ADMIN;

export const ALL_PERMISSIONS: Permission[] = Object.entries(PERMISSION_GROUPS).flatMap(([group, actions]) =>
  actions.map((action) => `${group}.${action}` as Permission),
);

export function isRolePermission(value: unknown): value is RolePermission {
  return value === SUPER_ADMIN || ALL_PERMISSIONS.includes(value as Permission);
}
