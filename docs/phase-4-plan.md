# Phase 4 plan: Shopify-style admin

Goal: every admin screen is rebuilt from one small design system, every item in `docs/ui-audit.md` is fixed, staff/roles/activity screens exist, and the demo account can see everything but change nothing. Works the same on PocketBase, Supabase and SQLite.

Done when lint, typecheck and both builds pass, and every audit item below is ticked. Click-through testing happens at the end, with the tools you'll provide.

## Decisions (proposed defaults — say if you want otherwise)

1. **Staff stay in `users` + `team_members`** (no separate `staff` table as §5 of the rebuild plan said). Supabase Auth has one user pool, so a separate table would only duplicate it. Staff and customers are already kept apart where it matters: separate login pages, separate apps, and a signed-up customer never gets admin access. New: `team_members.locale` (the admin language) and `avatar`.
2. **Clean admin URLs without a language**: `/orders`, `/products/123`, `/settings/shipping`, `/login`. The admin language comes from the staff member's profile (fallback: the browser's language). The `[lang]` segment and `/dashboard` prefix go away in the admin only; the store keeps `/{lang}/…`.
3. **Demo login stays `demo@admin.com`** (as you asked) with the password from `DEMO_ADMIN_PASSWORD` (default `jkdvPfuPrpetttcS`).
4. **Shop items from the audit**: the ones caused by data the admin now manages (X3 filters, X4 swatches, X5 sale price, X9 checkout country) are fixed in this phase; the phone header (X1), cart drawer (X7) and cart flash (X8) too, since they're small. Menu and hero (X2, X6) belong to the theme editor (phase 6b).

## Status

- **Step 1 — done.** admin-ui package, clean URLs, admin language, top bar / sidebar / search, plurals.
- **Step 2 — done.** Migrations `0004_admin` (SQL) and `1793059209_admin.js` (PocketBase), both applied on a throwaway database; contract, all three backends, actions, hooks. Differences from the table below:
  - No `products.options` column: options (Color, Size) are derived from the variants, so they can't drift apart.
  - No `orders.fulfillment_status`: "fulfilled" = shipped or delivered, "unfulfilled" = the open statuses (one source of truth, the order status). Bulk "Mark as fulfilled" ships each order through the lifecycle rules.
  - Internal customer notes are in a new `customer_notes` table (customers can edit their own `users` row in PocketBase); `accepts_marketing` is on `users`.
  - New: `site_assets` (PocketBase only) for logo/favicon files, `categories.view` and `customers.edit` permissions, error codes `member_exists`, `role_name_taken`, `system_role`, `role_in_use`, `cannot_change_self`, `demo_read_only`.

## Step 1 — Foundation

- **`packages/admin-ui`** (new package), built on `packages/ui`:
  - `Page` — title, back link, primary/secondary actions, tabs, "…" menu
  - `IndexTable` — saved-view tabs, search, filter chips, sortable columns, row selection + bulk-action bar, pagination, empty state, responsive (columns collapse; phone shows stacked rows with badges)
  - `DetailLayout` — main column cards + sidebar cards, `Timeline`
  - `FormPage` + `SaveBar` — sticky "Unsaved changes · Discard / Save", warns before leaving
  - `SettingsLayout` — section list on the left, content on the right
  - Shared: `StatusBadge` (tones: attention / success / info / neutral / critical), `MoneyInput` (localized), `LocalizedFields` (en/es/it with "filled" dots), `ImageManager` (upload, reorder, assign to a color), `Thumbnail`, `ConfirmDialog`, skeletons
- **Admin app restructure**: drop `[lang]` and `/dashboard`; new top bar (page title on phones, global search for orders/products/customers, profile menu with language and sign-out); new sidebar (Home, Orders, Products › Categories › Import, Customers, Messages, Settings).
- **Plurals**: `plural(lang, count, { one, other })` with `Intl.PluralRules`; dictionary keys become `{ one, other }` pairs (A4).
- Admin dictionaries move to their own namespace so the store bundle doesn't carry admin text.

## Step 2 — Data contract and schema (all three backends)

New migration in `pb_migrations/` and `packages/backend-sql/migrations.ts` (`0004_admin`):

| Change | For |
|---|---|
| `team_members.locale`, `avatar` | admin language, profile |
| `roles`: seed `demo` (every `*.view`, flagged read-only) | demo |
| `products.options` (json: `[{ name: "Color", values: [...] }, { name: "Size", ... }]`) | P2 |
| `product_images.color` (option value, empty = all colors) | P5, X4 |
| `categories.sort_order` / `parent_id` used as a tree (already exist) | C2 |
| `orders.fulfillment_status` (`unfulfilled`, `fulfilled`), `fulfilled_at` | O2 |
| `users.accepts_marketing`, `users.note` (internal) | customers |
| `saved_views` (staff, resource, name, filters json) | A1 |

Backend contract additions: list queries with filters/sort/pagination for every index table, bulk operations (products: publish, archive, delete, set category; orders: mark fulfilled, cancel, export CSV; messages: mark read, delete), fulfill order, staff CRUD + invite, roles CRUD, activity log list, image upload for the logo/favicon, global search.

## Step 3 — Screens

| Screen | What changes | Audit |
|---|---|---|
| Home | KPI row with "vs previous period", sales chart, to-do cards ("3 orders to fulfill", "2 unread messages"), stock card grouped by product, out-of-stock separate from low stock | H1–H3 |
| Orders | Index table with views (All, Unfulfilled, Unpaid, Open, Archived), colored badges, phone rows show statuses | A1, A3, A6, O1 |
| Order page | Main column: Unfulfilled/Fulfilled card with items and thumbnails + "Fulfill" dialog (carrier, tracking); Payment card (subtotal, shipping, tax, total, paid/balance); Timeline. Sidebar: customer, addresses, note with autosave + "Saved" | O2–O5 |
| Products | Index table (views: All, Active, Draft, Archived), 44px bordered thumbnails, no horizontal scroll, shorter search placeholder | P3, P4, P6 |
| Product editor | Form page + save bar; opens on the admin's language with "filled" dots per language; Options (Color, Size) → variants grouped by color, collapsible, bulk edit price/stock; images assigned to a color | P1, P2, P5, A5 |
| Categories | Tree with drag to reorder/nest, delete in the row "…" menu with confirmation | C1, C2 |
| Customers | Index table + detail page (orders, addresses, note, marketing consent) | A1 |
| Messages | Index table + reading pane, bulk mark read/delete | A1, A3 |
| Import | Kept, restyled with the Page pattern | – |

## Step 4 — Settings, staff, roles, activity

Settings layout with sections: **General** (name, logo + favicon upload, contact, address, socials), **Languages** (capitalized names with flags), **Shipping**, **Taxes**, **Payments**, **Legal pages**, **Staff**, **Roles**, **Activity**, and a **Domains** placeholder for phase 6. One save bar per section instead of one button per field; no "Default" badges (S1–S3).

- Staff: list, invite (email with a set-password link; Supabase uses its invite), change roles, deactivate, nobody changes their own access unless admin.
- Roles: permission matrix with translated labels; system roles can't be deleted; `isSuperAdmin` only assignable by admins.
- Activity: filterable log, including refused attempts.
- Profile (from the top-bar menu): name, admin language, password.

## Step 5 — Demo mode

- `DEMO_MODE=true` → on setup: create `demo@admin.com` with the `demo` role and load sample data (categories, products with images, orders in every status, customers, messages).
- `authorize()` refuses every non-`.view` permission for a read-only role with a new `demo_read_only` error ("This is a demo: changes are disabled"); profile/password changes and emails are refused too. Buttons stay visible so the demo shows the real admin.
- Login page shows "Try the demo" with the credentials when `DEMO_MODE` is on.
- `npm run demo:reset` restores the sample data (for a nightly Railway cron).
- `seed`, `create-admin` and `import-products` scripts become backend-neutral (they're PocketBase-only today); the demo seeding needs that anyway.

## Step 6 — Storefront fixes

X1 phone header · X3 filters per option, collapsible · X4 swatches with the color's photo, identical colors grouped · X5 product page opens on the sale/cheapest color with compare-at price per variant · X7 cart drawer · X8 cart rendered on the server first · X9 country pre-selected, titles wrap, taxes line.

## Order of work

Steps 1 → 2 → 3 → 4 → 5 → 6. Each step ends with lint, typecheck and build passing. Nothing is committed until you say so.

## Not in this phase

Domains (phase 6), theme editor with menus and hero (phase 6b), public repo and live demo deploy (phase 7), Stripe.
