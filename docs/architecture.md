# Architecture and conventions

## Monorepo

npm workspaces. Each app imports the packages through tsconfig paths (`@repo/core/…`, `@repo/ui/…`, `@repo/admin-ui/…`, `@repo/backend-*/…`). Packages never import from an app.

| Folder | What |
|---|---|
| `apps/store` | Storefront: shop, product pages, cart, checkout, customer account, sign-in. Routes under `app/[lang]/` (`en`, `es`, `it`) |
| `apps/admin` | Admin for staff. No language in the URL (the staff member's choice is a cookie). `app/(admin)` = screens with the sidebar, `app/(editor)` = the full-screen theme editor, `app/(auth)` = sign-in |
| `packages/core` | `backend/` (the contract + `getBackend()`), `actions/` (server actions), `lib/` (auth, pricing, settings, schemas), `hooks/` (TanStack Query), `themes/` (templates), `dictionaries/` |
| `packages/backend-*` | One implementation of the backend contract per database |
| `packages/ui` | shadcn/ui components and the shared theme (`styles/globals.css`) |
| `packages/admin-ui` | The admin's building blocks: `Page`, `IndexTable`, `DetailLayout`, `SaveBar`, `SettingsLayout`, `StatusBadge`… |

## One backend contract, three databases

Actions and pages never use a database SDK. They call `getBackend()` (`packages/core/backend/index.ts`), chosen by the `BACKEND` variable, whose shape is `packages/core/backend/types.ts`.

- **PocketBase:** schema in `pb_migrations/*.js` (applied when PocketBase starts), types in `packages/backend-pocketbase/pocketbase-types.ts` (`npm run typegen`). Collections are locked by API rules; the server uses a superuser client after checking permissions.
- **Supabase and SQLite:** shared SQL code with Kysely (`packages/backend-sql`). The schema is the list of migrations in `packages/backend-sql/migrations.ts` (`npm run db:setup`). Add a new migration at the end; never edit one that has run. Supabase tables have row-level security on and no policies: only the server's secret key reaches them.

Business rules (pricing, discounts, the order lifecycle, merging guest and registered customers, dashboard maths) live in `packages/core/lib`, so every backend behaves the same.

## Server actions

Every action follows the same order: **authorize → validate (Zod) → backend call → `ActionResult`**.

- `authorize("orders.edit", "refund an order")` checks the signed-in staff member's permission, refuses read-only roles on anything but `.view`, and logs refused attempts.
- Errors come back as codes that are keys of the `errors` dictionary, so the admin shows them in the staff member's language.
- Public actions (checkout, contact form, newsletter) validate everything, never accept prices from the browser, and are rate-limited.

## Permissions

A permission is `group.action` (`orders.refund`, `themes.edit`) from `PERMISSION_GROUPS` in `packages/core/lib/permissions.ts`. Roles hold a list of them; `admin` has `isSuperAdmin`. Any permission in a group implies that group's `.view`. A read-only role (the demo) can open every screen it can view and change nothing.

## Settings

Everything an owner changes without a deploy is a site setting: `SITE_SETTINGS` in `packages/core/lib/site-settings.ts` lists each key with its Zod schema and default. A missing or invalid stored value falls back to the default, so a fresh database still renders. Read them with `getSiteSettings()` on the server.

## Themes and pages

- **Templates** are code in `packages/core/themes/templates/`. A theme is `{ settings, pages }`, validated by `packages/core/lib/schemas/theme.ts`.
- **The `themes` table** holds the library: draft, published version, last 10 versions, one live theme.
- **The look:** a theme's colours, fonts and radius become CSS variables (`packages/core/themes/css.ts`) that override the design tokens, so components keep using classes like `bg-primary`.
- **Rendering:** store pages render a page's sections with `ThemeSections` (`apps/store/components/sections/`).
- **Live preview:** the editor shows `/[lang]/theme-preview/[token]` in an iframe, signed with `THEME_PREVIEW_SECRET`.
- **Custom pages** (`pages` table) and the menus (the `NAVIGATION` setting) aren't part of a theme, so switching themes keeps them.

## Text and languages

User-facing text is never hard-coded: it's in `packages/core/dictionaries/{en,es,it}.json` (store and shared) and `dictionaries/admin/` (admin only). `en.json` defines the shape, so a missing key in another language is a type error. Catalog and page content is stored per language (`{ en, es, it }`).

## Code style

- TypeScript strict, no `any`.
- Values and props are `snake_case`, functions `camelCase`, components and types `PascalCase`. ESLint enforces it.
- Server Components by default; `"use client"` only on the smallest component that needs it.
- Server data goes through TanStack Query, never Zustand (the cart keeps only variant ids and quantities).
- Theme tokens only, no raw colours.
- Before a change is done: `npm run lint`, `npm run typecheck`, `npm run build`.
