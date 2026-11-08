import { z } from "zod";

import { LOCALES } from "@repo/core/i18nConfig";
import { isRolePermission, type RolePermission } from "@repo/core/lib/permissions";
import { id_schema } from "@repo/core/lib/schemas/ids";

export const admin_locale_schema = z.object({ locale: z.enum(LOCALES) });
export type AdminLocaleInput = z.infer<typeof admin_locale_schema>;

// Global search needs 2 characters: one letter would match most of the store.
export const admin_search_schema = z.object({ query: z.string().trim().min(2).max(100) });
export type AdminSearchInput = z.infer<typeof admin_search_schema>;

// Bulk actions: the selected rows of one index-table page (pages hold at most 250).
export const bulk_ids_schema = z.array(id_schema).min(1).max(250);

// ---------- Site assets ----------

export const SITE_ASSET_KINDS = ["logo", "favicon"] as const;
export type SiteAssetKind = (typeof SITE_ASSET_KINDS)[number];

// ---------- Activity log ----------

export const activity_filters_schema = z.object({
  search: z.string().trim().max(100).catch(""),
  result: z.enum(["all", "denied"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ActivityFilters = z.infer<typeof activity_filters_schema>;

// ---------- Staff ----------

export const role_name_schema = z
  .string("required")
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(50, "too_long")
  .regex(/^[a-z0-9_-]+$/, "invalid_slug");

const role_names_schema = z.array(role_name_schema).max(20);

export const invite_member_schema = z.object({
  email: z.email("invalid_email").trim().toLowerCase(),
  name: z.string().trim().max(100, "too_long"),
  roles: role_names_schema,
  is_admin: z.boolean(),
});
export type InviteMemberInput = z.infer<typeof invite_member_schema>;

export const update_member_schema = z.object({
  user_id: id_schema,
  roles: role_names_schema.optional(),
  is_admin: z.boolean().optional(),
  is_active: z.boolean().optional(),
});
export type UpdateMemberInput = z.infer<typeof update_member_schema>;

// ---------- Roles ----------

const permissions_schema = z
  .array(z.string())
  .max(100)
  .refine((values) => values.every(isRolePermission), "invalid")
  .transform((values) => [...new Set(values)] as RolePermission[]);

export const role_schema = z.object({
  name: role_name_schema,
  description: z.string().trim().max(300, "too_long"),
  permissions: permissions_schema,
});
export type RoleInput = z.infer<typeof role_schema>;

export const role_name_input_schema = z.object({ name: role_name_schema });
export type RoleNameInput = z.infer<typeof role_name_input_schema>;

// ---------- Saved views ----------

export const SAVED_VIEW_RESOURCES = ["orders", "products", "customers", "messages"] as const;
export type SavedViewResource = (typeof SAVED_VIEW_RESOURCES)[number];

export const saved_view_schema = z.object({
  resource: z.enum(SAVED_VIEW_RESOURCES),
  name: z.string().trim().min(1, "required").max(60, "too_long"),
  // The index table's URL state (search, filters, sort), as strings.
  filters: z
    .record(z.string().max(30), z.string().max(200))
    .refine((value) => Object.keys(value).length <= 12, "invalid"),
});
export type SavedViewInput = z.infer<typeof saved_view_schema>;

export const saved_view_id_schema = z.object({ id: id_schema });
