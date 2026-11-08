# Storefront template

An open-source clothing store you can run as your own: a fast storefront with a Shopify-style one-page checkout, and an admin with orders, products, customers, themes and settings. Built with Next.js (App Router), React 19 and Tailwind CSS. It runs on the backend you prefer: **PocketBase**, **Supabase** or **SQLite**.

Nothing about a particular shop is hard-coded. The store name, logo, contact details, currency, shipping rates, taxes, payment methods, legal text, the look and the home page are all edited from the admin, so you can run it without touching code.

## Live demo

- **Store:** _link added after the first deploy_
- **Admin:** _link added after the first deploy_
  - email: `demo@admin.com`
  - password: `jkdvPfuPrpetttcS`

The demo admin can open every screen, but every change is refused (read-only role). Orders placed on the demo store with cash on delivery show up in the demo admin.

## Features

**Storefront**
- Shop with filters (category, size, colour, price, in stock), sorting and search. Product pages with variants (size and colour), per-variant stock and price, a photo gallery and structured data for search engines.
- Cart drawer, and a one-page checkout modelled on Shopify's layout: contact → delivery → shipping method → payment, with a sticky order summary, a discount field, taxes and shipping computed on the server.
- Payments: cash on delivery, and a card form placeholder ready for a payment provider (Stripe is planned).
- Customer accounts: orders with their status timeline, saved addresses, profile and password.
- English, Spanish and Italian, with the language detected from the browser or the visitor's country. Light and dark mode.

**Admin**
- Dashboard with sales, orders to fulfil and cash on delivery to collect.
- Orders with filters, saved views, bulk actions, a status timeline, refunds and notes.
- Products with variants, images, bulk editing and CSV import. Categories in a tree.
- Customers (registered and guests), staff notes, marketing consent. A contact-form inbox.
- **Themes:** four templates (Atelier, Minimal, Bold, Classic), a theme library, and a full-screen editor with a live preview:
  - colours for light and dark mode, fonts, corner rounding, button and card styles, header layouts
  - home, product, about and contact pages built from sections (hero, product grids, image with text, gallery, video, FAQ, newsletter, contact form…)
  - draft → publish, with the last 10 versions kept
- **Pages:** your own pages (size guide, lookbook…) built from the same sections. Header menu and footer editor. Image uploads.
- **Domains:** connect your own domain, follow the DNS status, and redirect every other address to it. Railway and Vercel can attach domains automatically.
- **Staff and roles:** a permission matrix per role, a read-only demo role, and an activity log that also records refused attempts.
- All settings in one place: store details, languages, shipping rates, taxes, payment methods, legal pages.

## How it's built

| Folder | What |
|---|---|
| `apps/store` | The storefront (Next.js), port 3000 |
| `apps/admin` | The admin (Next.js), port 3001. Staff only, no sign-up |
| `packages/core` | Shared code: the backend contract, server actions, pricing and order rules, settings, themes, text in en/es/it |
| `packages/backend-pocketbase` · `backend-supabase` · `backend-sqlite` · `backend-sql` | The three backends behind one interface (`BACKEND=pocketbase \| supabase \| sqlite`). Supabase and SQLite share the SQL layer (Kysely) |
| `packages/ui` · `packages/admin-ui` | UI components (shadcn/ui) and the admin's design system |
| `pb_migrations/` · `pb_hooks/` | PocketBase schema |

Prices, totals, shipping and taxes are always computed on the server; the browser only sends product variant ids and quantities. More in [docs/architecture.md](docs/architecture.md).

## Run it locally

Requirements: Node.js 22 or newer, npm.

```bash
npm install
```

Copy `.env.example` to `.env.local` in the project root, and also to `apps/store/.env.local` and `apps/admin/.env.local`. Then follow the steps for your backend.

### PocketBase (default)

1. Download PocketBase 0.40 for your system from [pocketbase.io](https://pocketbase.io/docs/) and put the binary in the project root (`pocketbase.exe` on Windows, `pocketbase` elsewhere).
2. In the `.env.local` files, set `BACKEND=pocketbase` and fill in:
   - `POCKETBASE_SUPERUSER_EMAIL` and `POCKETBASE_SUPERUSER_PASSWORD` (10+ characters): the database's own admin account
   - `STORE_ADMIN_EMAIL` and `STORE_ADMIN_PASSWORD` (8+ characters): your account for the store admin
3. `npm run pb`. It applies the schema, creates both accounts, and serves PocketBase on http://127.0.0.1:8090.

### Supabase

Create a Supabase project, fill in the Supabase variables in `.env.local`, then `npm run db:setup`. Step by step in [docs/supabase.md](docs/supabase.md).

### SQLite

Set `BACKEND=sqlite` and run `npm run db:setup`. The database and uploaded images live in `data/`. Details in [docs/sqlite.md](docs/sqlite.md).

### Start the apps

```bash
npm run seed         # optional: sample categories and products
npm run dev:store    # http://localhost:3000
npm run dev:admin    # http://localhost:3001 (sign in with STORE_ADMIN_EMAIL)
```

For the theme editor's live preview, set the same `THEME_PREVIEW_SECRET` (any random text, 16+ characters) in both apps' `.env.local`.

## Deploy

Railway runs everything: PocketBase (or SQLite) and both apps. Vercel can host the two apps with Supabase or a Railway PocketBase. The full guide, with every variable per service, is [docs/deploy.md](docs/deploy.md).

## Useful commands

| Command | What it does |
|---|---|
| `npm run create-admin -- <email> <password> [name]` | Creates or promotes a store owner |
| `npm run seed` | Sample categories and products (safe to re-run) |
| `npm run demo:seed` / `npm run demo:reset` | The public demo: demo admin, customers, orders in every status, themes and pages |
| `npm run import-products -- products.csv` | CSV import from the command line (also in the admin: Products → Import) |
| `npm run typegen` | Regenerates the PocketBase types after a schema change |
| `npm run lint` · `npm run typecheck` · `npm run build` | Checks |

## More docs

- [Architecture and conventions](docs/architecture.md)
- [Deploy](docs/deploy.md)
- [Themes and pages](docs/themes.md)
- [Custom domains](docs/domains.md)
- [Supabase backend](docs/supabase.md) · [SQLite backend](docs/sqlite.md)

## License

MIT, see [LICENSE](LICENSE).
