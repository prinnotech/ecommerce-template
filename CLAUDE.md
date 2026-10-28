# Boutique Pence 1979 — clothing store template

Follow the code style and architecture rules in this file for all work in this project:

@webapp-template-code-style.md

Before calling a change done, run `npm run lint`, `npm run typecheck` and `npm run build`.

The rules below are **app-specific notes**. Where they differ from the style guide, these win (the style guide is written for Supabase; this app uses PocketBase).

---

## What this app is

A resellable e-commerce template for clothing stores, built with **Next.js (App Router) + PocketBase**. "Boutique Pence 1979" is only the **default value** of the `SITE_NAME` setting. Every store-specific value (name, address, email, phone, socials, currency, shipping fees, legal text, logo) lives in `site_settings` and is edited from the admin dashboard. **Nothing about a specific store is hard-coded**, so a buyer of the template can run it without touching code.

### Pages
| Area | Routes (all under `app/[lang]/`) |
|---|---|
| Storefront | home, `shop` (catalog with filters), `shop/[slug]` (product), `cart`, `checkout`, `checkout/[session_id]/thank-you`, `about`, `contact`, `privacy`, `terms` |
| Customer account | `account` (overview), `account/orders`, `account/orders/[id]`, `account/addresses`, `account/profile` |
| Admin dashboard | `dashboard` (overview), `dashboard/products`, `dashboard/products/[id]`, `dashboard/orders`, `dashboard/orders/[id]`, `dashboard/customers`, `dashboard/categories`, `dashboard/settings`, `dashboard/users`, `dashboard/roles`, `dashboard/activity` |
| Auth | `auth/login`, `auth/register`, `auth/reset-password`, `auth/new-password` |

### UX references
- **Checkout = Shopify's one-page checkout layout and flow**: two columns on desktop (left: contact → delivery address → shipping method → payment → "Pay now"/"Complete order"; right: sticky order summary with line items, discount field, subtotal, shipping, taxes, total). On mobile the summary collapses into a "Show order summary" bar at the top. Copy the layout, field order, spacing and behaviour. **Don't copy Shopify's logos, brand name or assets.**
- **Admin dashboard = Stripe Dashboard style**: dense data tables with filters and search, status badges, detail pages with a timeline of events, a left sidebar, quick actions in a top-right menu.

---

## Stack changes vs the style guide

| Style guide | This app |
|---|---|
| Supabase (Postgres, Auth, Storage) | **PocketBase 0.41** (SQLite, auth collections, file fields) via the `pocketbase` JS SDK |
| `supabase/migrations/*.sql` | **`pb_migrations/*.js`** (timestamped JS migrations) — the source of truth for the schema |
| `types/supabase-types.ts` | **`types/pocketbase-types.ts`**, generated with `pocketbase-typegen`. Never edit by hand |
| RLS policies | **Collection API rules** (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) |
| Stripe Checkout | **Not connected yet.** Our own `checkout_sessions` + payment providers (see Payments) |
| `site_config` table | **`site_settings` collection** (same key/value model as §12, renamed) |

Everything else in the style guide (Next.js App Router, React Compiler, Tailwind v4, shadcn, TanStack Query, Zustand, Zod, `next-i18n-router` with `en`/`es`/`it`, actions + `ActionResult`, naming, ESLint rules) applies unchanged.

---

## PocketBase rules

### Clients: `lib/pocketbase/`
| Helper | File | Where | For |
|---|---|---|---|
| `createServerPocketBase()` | `pocketbase-server.ts` | Server Components, actions, route handlers | A per-request client loaded from the `pb_auth` cookie. User-scoped reads/writes under API rules. **Default.** |
| `createAdminPocketBase()` | `pocketbase-server.ts` | Actions and route handlers **after authorization** | Superuser client (`POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD`). Admin and cross-user work, collections with `null` rules |
| `createBrowserPocketBase()` | `pocketbase-client.ts` | Client components | Realtime subscriptions and public reads only. Never holds the auth token |
| `updateSession()` | `pocketbase-proxy.ts` | `proxy.ts` only | Refreshes the `pb_auth` cookie when it is close to expiry |

- **Never create a PocketBase client per module or as a global singleton on the server.** A shared server instance would leak one user's auth to another request. Always one client per request.
- ESLint blocks importing `pocketbase` outside `lib/pocketbase/` (replaces the Supabase import rule).
- No generic `getRecord(collection)` helpers: query typed collections inside the domain action.

### Auth (replaces §10 details)
- The auth token lives in an **httpOnly, secure, sameSite=lax cookie `pb_auth`**. Sign-in, sign-up, sign-out and password reset run as **server actions** (not in the browser client) so JavaScript never sees the token.
- **Hard rule 1 becomes: never trust `pb.authStore.isValid` or the decoded cookie on the server to decide who the user is.** `isValid` only checks expiry locally. `getCurrentUserId()` / `getCaller()` in `lib/auth.ts` verify the token with `authRefresh()` (cached per request).
- One `users` auth collection holds **customers and staff**. A signed-up user is a customer only. Staff access comes from a `team_members` row (relation to `users`, `roles`, `is_admin`, `is_active`) that only an admin creates. **Signing up never grants dashboard access** (unlike the template's `on_auth_user_created` default `member` role).
- Dashboard actions start with `const auth = await authorize("settings.edit", "update a site setting"); if (!auth.ok) return auth;` (`lib/auth.ts`). It returns `not_signed_in` / `forbidden`, logs refused attempts, and gives you `auth.caller`.
- The PocketBase superuser (`/_/` admin UI) is the deployer's account, not the store owner's. The store owner is a `users` record with an `is_admin` team member row.
- Both are created on the first start of a deployment by `pb_migrations/1793059208_bootstrap_admins.js`, from `POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD` and `STORE_ADMIN_EMAIL` / `STORE_ADMIN_PASSWORD`. Existing accounts are left untouched. It's a migration (not an `onBootstrap` hook) because in PocketBase 0.41 app migrations run after `onBootstrap`, so the `users` / `team_members` collections don't exist there on a fresh database, and JS hooks have no `onServe`.

### Collections and API rules (replaces §9 "Schema and security")
- **Every collection has all five API rules set explicitly in its migration.** `null` (locked) means only the superuser client can reach it — the equivalent of "RLS with no policies". Use it for `payments`, `activity_log`, `checkout_sessions`.
- An empty string rule (`""`) means **public**. Only use it on purpose (e.g. `listRule` on published `products`) and add a filter (`is_published = true`).
- Rules that depend on the user use `@request.auth.id` (e.g. orders: `user = @request.auth.id`).
- Collections and fields are `snake_case`, collections plural. PocketBase ids are 15-char strings (not uuids). Every collection has `created_at` and `updated_at` **autodate** fields. Soft delete with `deleted_at` where history matters (products, orders).
- Money: **integer cents** (`number` field, `onlyInt: true`). Times: `date` fields in UTC.
- Atomic multi-collection work (place order + decrement stock + clear cart): the **batch API** (`pb.createBatch()`) from the admin client, or a `pb_hooks/*.pb.js` hook when it must run inside PocketBase.
- Files (product images, logo) use PocketBase `file` fields. Build URLs with `getFileUrl()` from `lib/pocketbase/files.ts`; allow the PocketBase host in `next.config.ts` `images.remotePatterns`.

### Schema workflow (replaces §9 order)
1. Write a migration in `pb_migrations/<unix_timestamp>_<name>.js` (collections, fields, indexes, API rules).
2. Restart `pocketbase serve` locally (migrations apply on start).
3. Regenerate `types/pocketbase-types.ts`.
4. Update schemas, actions and hooks.

Don't create collections by clicking in the admin UI. If you do it while exploring, the auto-generated migration must be reviewed and cleaned before it's kept.

### Deploy
- **Only the schema ships**: `pb_migrations/` and `pb_hooks/`. `pb_data/` (the local database and uploads) is git-ignored and never deployed.
- PocketBase runs on **Railway** (with a volume for `pb_data`). Next.js runs on **Vercel or Railway**.
- `pocketbase.exe` in the repo root is the local Windows binary for development. It is git-ignored.

### Local commands
| Command | What it does |
|---|---|
| `npm run pb` | Runs local PocketBase on `127.0.0.1:8090` (applies new migrations on start). `npm run pb -- migrate up` / `migrate down 1` also work |
| `npm run dev` | Next.js dev server |
| `npm run typegen` | Regenerates `types/pocketbase-types.ts` from the running PocketBase (credentials from `.env.local`) |
| `npm run create-admin -- <email> <password> [name]` | Creates or promotes the store owner (users record + admin team member) |
| `npm run seed` | Sample categories/products for local testing. Re-runnable, never used in deploys |

### PocketBase gotchas
- **Always guard user rules with `@request.auth.id != ""`.** For anonymous requests PocketBase compares `""` with an empty join or field and can let visitors through (`@collection.x.user ?= @request.auth.id` matched anonymous users before the guard was added).
- A rule can only reference a collection that already exists: create both, then set the rule.
- After running `migrate` from the CLI while `serve` is running, restart `serve` (it caches collections).
- `bool` fields are never `required` (required means "must be true"); `number` fields marked `required` reject `0`.
- The built-in `users` collection's `created`/`updated` were renamed to `created_at`/`updated_at` like every other collection.

### Next.js config notes
- `cacheComponents` is **off**: auth guards in layouts read cookies outside Suspense (hard rule 16), which Cache Components rejects.
- `app/[lang]/layout.tsx` sets `revalidate = 60`, so static pages pick up setting changes within a minute. `updateSetting()` should also call `revalidatePath("/", "layout")`.

---

## Site settings (§12, adapted)

- Collection **`site_settings`**: `key` (UPPER_SNAKE, unique index), `category`, `value` (json), `description`, `is_public` (bool), `updated_by` (relation to `users`), `created_at`, `updated_at`.
- API rules: `listRule` / `viewRule` = `is_public = true`. Create, update, delete = `null` (writes go through `updateSetting()` with the admin client after a `settings.edit` check).
- The `SITE_SETTINGS` contract in `lib/site-settings.ts` works exactly as §12 describes. Store-specific keys on top of the guide's defaults:
  - `SITE_NAME` (default `"Boutique Pence 1979"`), `SITE_LOGO`, `SITE_DESCRIPTION`
  - `SITE_CONTACT` (email, phone, whatsapp), `STORE_ADDRESS` (street, city, region, postal code, country), `SOCIAL_LINKS`
  - `CURRENCY`, `DEFAULT_LOCALE`, `TIMEZONE`, `MAINTENANCE_MODE`
  - `SHIPPING_RATES` (list of methods with name and price in cents), `FREE_SHIPPING_THRESHOLD`, `TAX_RATE`, `TAX_INCLUDED`
  - `PAYMENT_METHODS` (which methods are enabled: `card`, `cash_on_delivery`), `COD_FEE`
  - `ABOUT_CONTENT`, `PRIVACY_POLICY`, `TERMS_AND_CONDITIONS` (legal text per locale)

---

## Commerce rules

- **Prices, totals, shipping and tax are always computed on the server** from `products`/`product_variants` and settings. The cart sent by the client is only `{ variant_id, quantity }[]` (hard rule 3).
- Products have **variants** (size, color) with their own SKU, stock and optional price override.
- The cart is a Zustand store persisted in `localStorage` (only ids and quantities). Product data for the cart is fetched with TanStack Query, never stored in Zustand.
- Order statuses: `pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`. Payment statuses are separate: `unpaid`, `paid`, `failed`, `refunded`. Every status change writes an `order_events` row (shown as the timeline on the order page).

### Payments (replaces §20 until Stripe is connected)
- `createCheckoutSession()` creates a `checkout_sessions` record (server-priced line items, totals, customer, attribution, `expires_at`). The checkout page reads the session by id.
- Providers live in `lib/payments/` behind one interface, so Stripe can be added later without changing the checkout UI:
  - **`card`**: a placeholder card form. The provider **always fails** with the `card_declined` error code. No card data is stored or sent anywhere; fields are validated for format only.
  - **`cash_on_delivery`**: completes the session, creates the order with status `pending` and payment status `unpaid`, and decrements stock.
- When Stripe is connected, §20 of the style guide applies.

---

## Gaps vs the style guide

- The template repo (`D:\Projects\nextjs-app-template`) is **not on this machine**, so patterns are written from the style guide. If it becomes available, copy from it instead.
- The style guide is not in `~/.claude/`; this file imports the copy in the project root.
