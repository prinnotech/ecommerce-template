# Boutique Pence 1979 — clothing store template

Follow the code style and architecture rules in this file for all work in this project:

@webapp-template-code-style.md

Before calling a change done, run `npm run lint`, `npm run typecheck` and `npm run build`.

The rules below are **app-specific notes**. Where they differ from the style guide, these win (the style guide is written for Supabase; this app uses PocketBase).

---

## What this app is

A resellable e-commerce template for clothing stores, built with **Next.js (App Router) + PocketBase**. "Boutique Pence 1979" is only the **default value** of the `SITE_NAME` setting. Every store-specific value (name, address, email, phone, socials, currency, shipping fees, legal text, logo) lives in `site_settings` and is edited from the admin dashboard. **Nothing about a specific store is hard-coded**, so a buyer of the template can run it without touching code.

### Repository layout (monorepo, npm workspaces)
| Folder | What | Local URL |
|---|---|---|
| `apps/store` | Next.js storefront: shop, cart, checkout, customer account, store auth | http://localhost:3000 |
| `apps/admin` | Next.js admin (staff only): dashboard, products, orders, customers, settings, staff auth | http://localhost:3001 |
| `packages/core` | Shared code used by both apps: `backend/` (the backend contract + `getBackend()`), `lib/` (auth, pricing, site settings…), `actions/` (server actions), `hooks/`, `providers/`, `store/` (Zustand), `dictionaries/`, `i18nConfig.ts`, shared components | – |
| `packages/backend-pocketbase` | PocketBase implementation of the backend contract (clients, cookie, file URLs, generated `pocketbase-types.ts`) | – |
| `packages/backend-sql` | Shared SQL implementation (Kysely): `migrations.ts` (the schema for Postgres and SQLite), `schema.ts`, one module per area | – |
| `packages/backend-supabase` | Supabase: Postgres via `backend-sql`, Supabase Auth, Storage (`docs/supabase.md`) | – |
| `packages/backend-sqlite` | SQLite: `node:sqlite` via `backend-sql`, built-in auth, local images served at `/media` (`docs/sqlite.md`) | – |
| `packages/ui` | shadcn components (`components/ui`), `cn()` in `lib/utils.ts`, theme in `styles/globals.css` (status tones `success` / `warning` / `info` for badges) | – |
| `packages/mcp` | The store's MCP server for AI assistants (`server.ts`, mounted by the admin at `/api/mcp`; `@modelcontextprotocol/sdk`) | – |
| `packages/admin-ui` | Admin design system: `Page`, `IndexTable` (+ `useUrlState`), `DetailLayout` / `SectionCard`, `SaveBar` (+ `useUnsavedChanges`), `SettingsLayout`, `StatusBadge`, `MoneyInput`, `LocalizedFields`, `ImageManager`, `Thumbnail`, `Timeline`, `ConfirmDialog`, `EmptyState`, skeletons. **Every admin screen is built from these** | – |
| root | `pb_migrations/`, `pb_hooks/`, `pocketbase.Dockerfile`, `scripts/`, ESLint/Prettier config, `tsconfig.base.json` | – |

Imports: `@/…` is the current app; `@repo/core/…`, `@repo/ui/…` and `@repo/backend-pocketbase/…` are the packages (tsconfig paths, compiled by each app). **Packages never import from an app.**

**Backend contract.** Actions and pages never talk to a database SDK: they call `getBackend()` (`packages/core/backend/index.ts`, picked by the `BACKEND` env variable) whose shape is `packages/core/backend/types.ts`. Actions keep the order *authorize → validate → backend call → `ActionResult`*; expected failures come back as `BackendError` codes and every catch block is `return failFrom(error, module, context)`. Business rules (pricing, discounts, order lifecycle, customer merging, dashboard maths) live in `packages/core/lib`, so every backend behaves the same. Only `packages/backend-pocketbase` may import `pocketbase` (ESLint enforces it). SQL backends: change the schema in `packages/backend-sql/migrations.ts` (new migration at the end, never edit an applied one), update `schema.ts`, then `npm run db:setup`. Postgres and SQLite differ in booleans and JSON: write plain values (the `ValuesPlugin` converts them) and read with `bool()` / `json()` / `iso()` from `values.ts`. Each app's `app/globals.css` imports the shared theme and adds `@source` lines so Tailwind scans the packages.

The rebuild plan (Supabase/PocketBase/SQLite backends, Shopify-style admin, domains, demo) is in `docs/rebuild-plan.md`; the UI audit in `docs/ui-audit.md`.

### Pages
| Area | App | Routes (under `app/[lang]/`) |
|---|---|---|
| Storefront | store | home, `shop`, `shop/[slug]`, `cart`, `checkout/[id]`, `checkout/[id]/thank-you`, `about`, `contact`, `privacy`, `terms` |
| Customer account | store | `account`, `account/orders`, `account/orders/[id]`, `account/addresses`, `account/profile` |
| Store auth | store | `auth/login`, `auth/register`, `auth/reset-password`, `auth/new-password` |
| Admin | admin | **No `[lang]` segment**: `/`, `/orders`, `/orders/drafts`, `/products`, `/products/inventory`, `/products/import`, `/categories`, `/customers`, `/messages` (route group `app/(admin)/`); `/settings/*` is a full-screen panel (route group `app/(settings)/`, sections in its `nav.ts`) |
| Staff auth | admin | `/login`, `/reset-password`, `/new-password` (route group `app/(auth)/`, no sign-up) |

### Admin language and text
- The admin has no language in its URLs. `getAdminLocale()` (`packages/core/lib/admin-locale.ts`) reads the `admin_locale` cookie (set from the profile menu or the sign-in page by `setAdminLocale()`), then the browser language, then `DEFAULT_LOCALE`. Old `/{lang}/dashboard/…` and `/{lang}/auth/…` links are redirected by `apps/admin/proxy.ts`.
- Guards: `requireCaller()` / `requirePermission(permission)` (no `lang`). Metadata: `buildAdminMetadata(title)`.
- Admin-only text lives in `packages/core/dictionaries/admin/{en,es,it}.json` (`getAdminDictionary()`, type `AdminDictionary` = shared + admin); the store never loads it.
- Text with a count is `{ "one": …, "other": … }` and is rendered with `formatPlural(count, text, lang)` (`lib/utils/format.ts`).

### Staff access rules
- Roles are addressed by their unique **name** (the SQL seed uses readable ids like `role_admin`). Seeded: `admin` (`isSuperAdmin`), `staff`, `demo`; SQL also has `member`.
- A **read-only role** (`roles.is_read_only`, the `demo` role) can open every screen it has a `.view` permission for; `authorize()` refuses anything else with `demo_read_only`. Actions that write under a `.view` permission (message triage, saved views) check `auth.caller.is_read_only` themselves.
- Any permission in a group implies its `.view` (`categories.edit` can open Categories), so a page guard uses the `.view` key.
- Customer notes for staff live in `customer_notes` (key = user id or `email:<address>` for guests), not on `users`, because customers may update their own `users` record in PocketBase.
- Staff invites: `auth.ensureUser()` + `staff.addMember()` + `auth.sendStaffInvite()`. SQLite and Supabase links land on the admin's `/new-password` (`NEXT_PUBLIC_ADMIN_URL`); PocketBase sends its own reset email to the store's page (`PB_APP_URL`).

### Domains
- Admin → Settings → Domains (`packages/core/actions/domains.ts`, `lib/hosting/`). `HOSTING_PROVIDER` = `railway` | `vercel` attaches domains through the host's API; empty = manual mode for any host (`HOSTING_*_TARGET_HOST` = a hostname → CNAME/ALIAS, or an IPv4 → A). Setup: `docs/domains.md`.
- The primary domain per app is the `PRIMARY_DOMAIN_STORE` / `PRIMARY_DOMAIN_ADMIN` setting; both proxies 301 every other host to it (`lib/primary-domain.ts`; localhost, IPs and previews are exempt).

### Themes (Online store → Themes)
- Templates are code in `packages/core/themes/` (`templates/*.ts`, listed in `themes/index.ts`; description under `themes.templates.<id>` in the admin dictionaries). A theme = `{ settings, sections }`, validated by `lib/schemas/theme.ts`; bad stored values fall back to the template's (`parseThemeData`).
- The `themes` table holds the library (draft, published, last 10 versions, one `is_live`). The store reads only the live theme's published data through `getLiveTheme()` (`lib/theme-server.ts`); no live theme = the default template (Atelier, the original look).
- Theme colours/fonts/radius become CSS variables (`themes/css.ts`) rendered by `<LiveThemeStyle />` in each storefront layout, not the root layout, so the preview page (`/[lang]/theme-preview/[token]`) can show a draft without the live rules underneath. Components keep using theme tokens.
- The editor (`apps/admin/app/(editor)/themes/[id]`, full-screen) autosaves the draft and shows the store in an iframe. `THEME_PREVIEW_SECRET` (same value in both apps) signs the preview token and the admin's `POST /api/revalidate` to the store after a publish.
- A theme lays out four pages (`theme.pages.home | product | about | contact`); the product page has one fixed `product_main` section. Which sections a page may have: `sectionTypesFor()` in `lib/schemas/theme.ts`. Store pages render them with `<ThemeSections>` (`apps/store/components/sections/theme-sections.tsx`).
- Themes saved before page templates (`{ settings, sections }`) are upgraded when read (`parseThemeData`); the removed `ABOUT_CONTENT` setting still seeds their About text (`getLegacyThemeValues`).
- Custom pages (Online store → Pages, `pages` table, `actions/pages.ts`) live outside themes and save directly (no draft); the store serves published ones at `/[lang]/pages/[slug]`. The editor edits their sections too (`?page=page:<id>`; `/themes/live` opens the live theme).
- Menus and footer: the `NAVIGATION` setting (`lib/schemas/navigation.ts`, `actions/navigation.ts`), edited in the editor's Navigation tab and live on save. Empty = the automatic menu/footer.
- Image uploads: the `media` table + each backend's file storage (`actions/media.ts`), jpg/png/webp/avif up to 10 MB.
- The home page's hero and announcement text moved from settings into the theme (`HERO_*`, `ANNOUNCEMENT` and `ABOUT_CONTENT` settings were removed).

### UX references
- **Checkout = Shopify's one-page checkout layout and flow**: two columns on desktop (left: contact → delivery address → shipping method → payment → "Pay now"/"Complete order"; right: sticky order summary with line items, discount field, subtotal, shipping, taxes, total). On mobile the summary collapses into a "Show order summary" bar at the top. Copy the layout, field order, spacing and behaviour. **Don't copy Shopify's logos, brand name or assets.**
- **Admin dashboard = Stripe Dashboard style**: dense data tables with filters and search, status badges, detail pages with a timeline of events, a left sidebar, quick actions in a top-right menu.

---

## Stack changes vs the style guide

| Style guide | This app |
|---|---|
| Supabase (Postgres, Auth, Storage) | **PocketBase 0.41** (SQLite, auth collections, file fields) via the `pocketbase` JS SDK |
| `supabase/migrations/*.sql` | **`pb_migrations/*.js`** (timestamped JS migrations) — the source of truth for the schema |
| `types/supabase-types.ts` | **`packages/backend-pocketbase/pocketbase-types.ts`**, generated with `pocketbase-typegen`. Never edit by hand |
| RLS policies | **Collection API rules** (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) |
| Stripe Checkout | Our own `checkout_sessions` first; Stripe **Checkout Sessions (Elements)** + webhook for cards, next to cash on delivery and manual methods (see Payments) |
| `site_config` table | **`site_settings` collection** (same key/value model as §12, renamed) |

Everything else in the style guide (Next.js App Router, React Compiler, Tailwind v4, shadcn, TanStack Query, Zustand, Zod, `next-i18n-router` with `en`/`es`/`it`, actions + `ActionResult`, naming, ESLint rules) applies unchanged.

---

## PocketBase rules

### Clients: `packages/backend-pocketbase/`
| Helper | File | Where | For |
|---|---|---|---|
| `createServerPocketBase()` | `pocketbase-server.ts` | Server Components, actions, route handlers | A per-request client loaded from the `pb_auth` cookie. User-scoped reads/writes under API rules. **Default.** |
| `createAdminPocketBase()` | `pocketbase-server.ts` | Actions and route handlers **after authorization** | Superuser client (`POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD`). Admin and cross-user work, collections with `null` rules |
| `createBrowserPocketBase()` | `pocketbase-client.ts` | Client components | Realtime subscriptions and public reads only. Never holds the auth token |
| `updateSession()` | `pocketbase-proxy.ts` | `proxy.ts` only | Refreshes the `pb_auth` cookie when it is close to expiry |

- **Never create a PocketBase client per module or as a global singleton on the server.** A shared server instance would leak one user's auth to another request. Always one client per request.
- ESLint blocks importing `pocketbase` outside `packages/backend-pocketbase/` (replaces the Supabase import rule).
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
- Files (product images, logo) use PocketBase `file` fields. The backend returns ready-made URLs (`getFileUrl()` in `packages/backend-pocketbase/files.ts`); allow the PocketBase host in each app's `next.config.ts` `images.remotePatterns`.

### Schema workflow (replaces §9 order)
1. Write a migration in `pb_migrations/<unix_timestamp>_<name>.js` (collections, fields, indexes, API rules).
2. Restart `pocketbase serve` locally (migrations apply on start).
3. Regenerate `packages/backend-pocketbase/pocketbase-types.ts` (`npm run typegen`).
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
| `npm run dev:store` / `npm run dev:admin` | Store on :3000 / admin on :3001. Each app reads its own `apps/<app>/.env.local` |
| `npm run typegen` | Regenerates `packages/backend-pocketbase/pocketbase-types.ts` from the running PocketBase (credentials from `.env.local`) |
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
- `apps/store/app/[lang]/layout.tsx` sets `revalidate = 60`, so static pages pick up setting changes within a minute. `updateSetting()` also calls `revalidatePath("/", "layout")`, but since the admin is a separate app that only clears the admin's cache: store pages update within the 60 s window (on-demand store revalidation is a later step).

---

## Site settings (§12, adapted)

- Collection **`site_settings`**: `key` (UPPER_SNAKE, unique index), `category`, `value` (json), `description`, `is_public` (bool), `updated_by` (relation to `users`), `created_at`, `updated_at`.
- API rules: `listRule` / `viewRule` = `is_public = true`. Create, update, delete = `null` (writes go through `updateSetting()` with the admin client after a `settings.edit` check).
- The `SITE_SETTINGS` contract in `lib/site-settings.ts` works exactly as §12 describes. Store-specific keys on top of the guide's defaults:
  - `SITE_NAME` (default `"Boutique Pence 1979"`), `SITE_LOGO`, `SITE_DESCRIPTION`
  - `SITE_CONTACT` (email, phone, whatsapp), `STORE_ADDRESS` (street, city, region, postal code, country), `SOCIAL_LINKS`
  - `CURRENCY`, `DEFAULT_LOCALE`, `TIMEZONE`, `MAINTENANCE_MODE`
  - `SHIPPING_RATES` (list of methods with name and price in cents), `FREE_SHIPPING_THRESHOLD`, `TAX_RATE`, `TAX_INCLUDED`
  - `PAYMENT_METHODS` (a list: Stripe, cash on delivery and any number of manual methods, each with its own name, instructions and fee), `STRIPE_PUBLISHABLE_KEY`
  - `SMTP`, `NOTIFICATIONS` (email templates per locale, staff recipients), `LOW_STOCK_THRESHOLD`
  - `PRIVACY_POLICY`, `TERMS_AND_CONDITIONS` (legal text per locale)

---

## Commerce rules

- **Prices, totals, shipping and tax are always computed on the server** from `products`/`product_variants` and settings. The cart sent by the client is only `{ variant_id, quantity }[]` (hard rule 3).
- Products have **variants** (size, color) with their own SKU, stock and optional price override.
- The cart is a Zustand store persisted in `localStorage` (only ids and quantities). Product data for the cart is fetched with TanStack Query, never stored in Zustand.
- Order statuses: `pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`. Payment statuses are separate: `unpaid`, `paid`, `failed`, `refunded`. Every status change writes an `order_events` row (shown as the timeline on the order page).

### Payments
- `createCheckoutSession()` creates a `checkout_sessions` record (server-priced line items, totals, customer, attribution, `expires_at`). The checkout page reads the session by id.
- Methods come from the `PAYMENT_METHODS` setting (Settings → Payments). Orders store the method's **id** (free text).
  - **Cash on delivery / manual methods**: `completeCheckout` places the order now (`placeSessionOrder`, status `pending`, payment `unpaid`).
  - **Stripe**: a Stripe Checkout Session (`ui_mode: "elements"`) charging the server's total; the **webhook** (`apps/store/app/api/stripe/webhook`) places the order (`lib/stripe/stripe-orders.ts`). Shown only when both keys are set.
- Secrets (Stripe secret key, webhook secret, SMTP password) are typed in the admin and stored encrypted (`lib/secrets.ts`, `SETTINGS_ENCRYPTION_KEY`, same value in both apps); an env variable with the same name wins.

### Emails, inventory, draft orders
- Order emails: `sendOrderEmails(template, order)` (`lib/email/order-emails.ts`) runs after the response (`after()`), logs to `email_log`, and is a no-op until SMTP is set up. Templates and their placeholders: `lib/email/templates.ts`.
- Inventory (Products → Inventory): every stock change made there goes through `inventory.adjust()` and is logged in `inventory_adjustments`. Orders (`reason: "order"`) and restocks on cancel/refund (`"restock"`) are logged too, with the order number as the note.
- Draft orders (Orders → Drafts, `actions/draft-orders.ts`, `lib/draft-orders.ts`): priced by the checkout rules plus custom lines (no variant, no stock), an own shipping price and a fixed discount. "Send invoice" opens a checkout session linked to the draft (the store's checkout then keeps the draft's prices: `draftForSession`); "Mark as paid" / "Payment pending" place the order directly with payment method `manual`. `placeSessionOrder` marks the draft completed.

### Marketing, catalog extras and integrations (phase 9, `docs/phase-9-plan.md`)
- **Discounts** (Marketing → Discounts, `actions/discounts.ts`, `lib/schemas/discounts.ts`): percent, fixed or free shipping; minimum, dates, total limit, once per customer, optional product/category limit. The checkout applies them through `lib/pricing.ts` (`findDiscount`, `isDiscountUsedBy` in `checkout-server.ts`). Date inputs in the store's time zone: `lib/utils/zoned-input.ts`.
- **SEO**: a `seo` json (`lib/schemas/seo.ts`) on products, categories and collections, edited with `SeoFields` (admin-ui); `generateMetadata` falls back to the normal title/description.
- **Shipping zones** (`SHIPPING_ZONES`, `SHIP_ONLY_TO_ZONES` settings, `lib/shipping.ts`): rates and tax per delivery country. The checkout requotes when the country changes (`shipping_unavailable` when no zone ships there).
- **Abandoned checkouts** (Orders → Abandoned, `lib/abandoned-checkouts.ts`): the email is saved on blur (`saveCheckoutContact`). The recovery email is sent by button, or automatically by `GET /api/cron/abandoned-checkouts` (store, `Authorization: Bearer CRON_SECRET`) after `NOTIFICATIONS.abandoned_delay_hours`.
- **Tracking** (Settings → Tracking, `TRACKING` setting, `META_CAPI_TOKEN` secret, `lib/tracking/*`): UTM and click ids are captured by the store proxy into a cookie and saved on orders (`attribution`). Pixels load only after cookie consent (`useCookieConsent`). Browser and server Purchase events share one `event_id`.
- **Analytics** (`lib/analytics.ts`, `analytics.view`): computed from orders (sales minus `refunded_total`), with a comparison period.
- **Refunds** (`refundOrder`, `refunds` table): an amount and/or lines, optional restock and email; payment status `partially_refunded` until the whole total is refunded.
- **Collections** (Products → Collections, `lib/schemas/collections.ts`, `lib/collections-server.ts`): manual or automatic (rules); store page `/[lang]/collections/[slug]`; theme product grids can show one.
- **Gift cards** (Products → Gift cards, `lib/gift-cards-server.ts`): issued by staff or sold as products (`products.is_gift_card`, issued when the order is paid). Customers type the code in the checkout's code field; a fully covered order is placed paid with method `gift_card`. Refunds come out of the money part first; anything above it goes back onto the card (`splitRefund` in `lib/orders.ts`, card found through the order's checkout session). Known gap: gift-card-only carts still charge shipping.
- **Reviews** (Products → Reviews, `actions/reviews.ts`, `reviews.view/edit`): only signed-in customers with a non-cancelled order of the product, one each, shown after staff approve. The product block (`product-main-section.tsx`) shows the stars, the list, the form and the JSON-LD `aggregateRating` (a fixed part of the product page, not a theme section).
- **Wishlist**: signed-in customers in `wishlist_items` (`actions/wishlist.ts`), guests in `store/wishlist-store.ts` (localStorage, ids only). `useWishlist()` hides the difference; `<WishlistSync />` in the store layout moves guest ids to the account after sign-in. Account → Wishlist lists them.
- **API keys and MCP** (Settings → API keys, `api_keys.view/edit`, `packages/mcp/server.ts`): the admin serves an MCP endpoint at `/api/mcp` (Streamable HTTP, stateless, `Authorization: Bearer sk_store_…`). Only the key's SHA-256 is stored. Each tool calls the normal server action inside `runAsApiUser()` (`lib/api-keys.ts`), which makes `getCurrentUser()` return the key's staff member, so permissions, the read-only role and the activity log apply unchanged. A key can't create keys. The demo role doesn't get `api_keys.view`.

---

## Gaps vs the style guide

- The template repo (`D:\Projects\nextjs-app-template`) is **not on this machine**, so patterns are written from the style guide. If it becomes available, copy from it instead.
- The style guide is not in `~/.claude/`; this file imports the copy in the project root.
