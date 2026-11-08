import { z } from "zod";

import { localized_text_schema } from "@repo/core/lib/localized";

// The store's header menu and footer (the NAVIGATION setting), edited in the theme editor's
// Navigation tab. Not part of a theme, so switching themes keeps the menus.

const link_id_schema = z.string().min(1).max(40);
// A page of the store ("/shop?category=women", "/pages/size-guide") or a full address.
const href_schema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), "invalid");

export const menu_link_schema = z.object({ id: link_id_schema, label: localized_text_schema, href: href_schema });
export type MenuLink = z.infer<typeof menu_link_schema>;

export const MAX_MENU_ITEMS = 12;
export const MAX_FOOTER_COLUMNS = 4;

export const menu_item_schema = menu_link_schema.extend({
  // One level of submenu.
  children: z.array(menu_link_schema).max(MAX_MENU_ITEMS),
});
export type MenuItem = z.infer<typeof menu_item_schema>;

export const footer_column_schema = z.object({
  id: link_id_schema,
  title: localized_text_schema,
  links: z.array(menu_link_schema).max(MAX_MENU_ITEMS),
});
export type FooterColumn = z.infer<typeof footer_column_schema>;

export const navigation_schema = z.object({
  // Empty = automatic: "Shop all" and the top-level categories.
  header: z.array(menu_item_schema).max(MAX_MENU_ITEMS),
  footer: z.object({
    // Empty = automatic: a Shop column (categories) and a Help column (about, contact, legal…).
    columns: z.array(footer_column_schema).max(MAX_FOOTER_COLUMNS),
    // Empty = the store description (Settings → General).
    about_text: localized_text_schema,
    show_contact: z.boolean(),
    show_payments: z.boolean(),
  }),
});
export type Navigation = z.infer<typeof navigation_schema>;

export const DEFAULT_NAVIGATION: Navigation = {
  header: [],
  footer: { columns: [], about_text: {}, show_contact: true, show_payments: true },
};
