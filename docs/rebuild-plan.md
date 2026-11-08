# Rebuild plan: Shopify-style store template

Status: **approved** (30 Oct 2026). Phases 0–2 done; the rest is being written, testing happens at the end.

## 1. Goals

1. **Separate apps like Shopify**: the shop and the admin are two apps on two addresses, sharing one backend.
2. **Choice of backend**: **Supabase** is the default and recommended one; **PocketBase** and **SQLite** are built-in alternatives.
3. **One consistent, Shopify-like admin**: every screen built from the same few patterns, fixing today's UI problems.
4. **Custom domains** managed from the admin (Settings → Domains).
5. **Theme editor like Shopify's**: edit the homepage sections, colors, fonts and layout from the admin with a live preview.
6. **Public open-source repo** with a **live demo** anyone can try (`demo@admin.com`).

Everything that exists today (shop, cart, checkout, customer account, products, categories, orders, customers, messages, settings, CSV import, translations, flag language switcher) is carried over. Most code moves and is re-wired rather than rewritten.

## 2. Architecture

```
                         ┌──────────────────────────────────────┐
                         │ BACKEND (one of three, chosen in env)│
                         │  supabase   (default)                │
                         │  pocketbase                          │
                         │  sqlite                              │
                         └──────────┬──────────────┬────────────┘
                                    │              │
          ┌─────────────────────────▼───┐   ┌──────▼──────────────────────────┐
          │ apps/admin  (Next.js)       │   │ apps/store  (Next.js)           │
          │ admin.yourstore.com         │   │ yourstore.com/{it,es,en}/…      │
          │ orders, products, customers,│   │ shop, product, cart, checkout,  │
          │ categories, messages,       │   │ customer account, about,        │
          │ settings, domains, import   │   │ contact, privacy, terms         │
          │ staff login only            │   │ customer login only             │
          └─────────────────────────────┘   └─────────────────────────────────┘
```

- The **store** keeps `/it/ /es/ /en/` in its addresses, plus IP and browser language detection and the flag switcher.
- The **admin** has no language in the address (`admin.yourstore.com/orders/1042`). The language comes from each staff member's profile setting.
- **Separate logins**: staff accounts and customer accounts are different records with different cookies on different domains. A customer account can never open the admin.

## 3. Repository layout (monorepo)

```
apps/
  store/                 Next.js – storefront + checkout + customer account
  admin/                 Next.js – admin
packages/
  core/                  backend interface, shared types, Zod schemas, pricing/tax,
                         order statuses, permissions, site-settings contract
  ui/                    shared shadcn components + theme tokens
  admin-ui/              admin design system (see §6)
  i18n/                  dictionaries (en/es/it) + helpers, split per app
  backend-sql/           shared Kysely schema, migrations + queries (used by Supabase and SQLite)
  backend-supabase/      Supabase adapter: Kysely on Postgres + Supabase Auth + Storage
  backend-sqlite/        SQLite adapter: Kysely on SQLite + Better Auth + local files
  backend-pocketbase/    PocketBase adapter: PocketBase SDK, auth and files
pocketbase/              pb_migrations + pb_hooks + Dockerfile (only for the PocketBase option)
supabase/                SQL for RLS policies, storage buckets, seed
docs/                    setup guides per backend, deploy guides, this plan
```

Tooling: npm workspaces + Turborepo (runs `lint`, `typecheck`, `build` across all packages). Same style guide and ESLint rules as today.

## 4. The backend interface

`packages/core` defines what the apps need, as plain TypeScript interfaces. Apps never import a database SDK directly.

| Area | Operations (examples) |
|---|---|
| Catalog | list/get products, variants, categories; create/update/delete; reorder images; import CSV |
| Orders | create from checkout session, list with filters, detail, status changes, events/timeline, tracking, refunds |
| Checkout | create session (server-priced), complete with payment provider, decrement stock atomically |
| Customers | list with stats, detail, addresses |
| Content | site settings, contact messages |
| Staff | staff users, roles, permissions, activity log |
| Auth (×2) | customer: sign up / in / out / reset password / verify; staff: sign in / out / reset |
| Files | upload, delete, public URL with size variants (thumbnails) |
| Domains | list/add/remove domains, status (stored data; hosting API is separate, §8) |

Each backend package exports one object implementing all of it; `BACKEND=supabase|pocketbase|sqlite` picks which one is loaded on the server.

### How each backend implements it

| | Supabase (default) | SQLite | PocketBase |
|---|---|---|---|
| Data | Kysely → Postgres | Kysely → SQLite (**same code** as Supabase) | PocketBase SDK |
| Schema changes | Kysely migrations | same Kysely migrations | `pb_migrations/*.js` |
| Customer + staff logins | Supabase Auth (staff flagged in `staff` table) | Better Auth (two user types) | two auth collections: `customers`, `staff` |
| Images | Supabase Storage + image transforms | local `uploads/` folder, resized with `sharp` | PocketBase file fields + thumbs |
| Atomic checkout | Postgres transaction | SQLite transaction | PocketBase batch API |
| Extra lock | Row Level Security on every table | – | collection API rules |
| Deploy | 2 Railway/Vercel apps + Supabase project | 2 apps + 1 volume (smallest/cheapest) | 3 services (PocketBase + 2 apps) |

Permission checks always happen in our server code (`authorize()`), so all three backends behave the same; Supabase RLS and PocketBase rules are a second layer.

## 5. Data model

Same tables as today, with these changes:

- **`staff`** (new, separate from customers): name, email, roles, is_active, locale (admin language), avatar.
- **`customers`**: the shop accounts (today's `users`), plus `accepts_marketing`, `note` (internal).
- **`roles`**: name + permissions list, editable in Settings → Staff (admin, member, **demo**, custom).
- **`domains`** (new): hostname, target (`store`/`admin`), is_primary, status (`pending`, `verified`, `active`, `error`), dns_records, last_checked_at.
- Unchanged in substance: `categories`, `products`, `product_variants`, `site_settings`, `checkout_sessions`, `orders`, `order_items`, `order_events`, `payments`, `addresses`, `discount_codes`, `contact_messages`, `activity_log`.
- Money stays in integer cents; times in UTC; soft delete on products and orders.

## 6. Admin redesign (Shopify-like)

The UI problems come from screens built one at a time. The admin gets a small design system in `packages/admin-ui`, and **every** screen is built only from it:

| Pattern | Used by |
|---|---|
| **Page layout**: title, back link, primary + secondary actions, optional tabs | every page |
| **Index table**: saved views as tabs, search, filter chips, sortable columns, row selection with bulk actions, pagination, empty state | orders, products, customers, categories, messages, staff |
| **Detail page**: two columns (main cards + sidebar cards), timeline | order, product, customer |
| **Form page**: cards with sections, sticky "Unsaved changes – Discard / Save" bar | product editor, settings sections |
| **Settings layout**: left list of sections, content on the right | settings |
| Shared bits: status badges, money input, localized (it/en/es) inputs, image manager, toasts, skeletons | everywhere |

Admin sections: Home, Orders, Products (+ Categories, Import), Customers, Messages, Settings (General, Domains, Shipping, Taxes, Payments, Languages, Legal pages, Staff & roles, Activity).

Before building, I'll do a full UI audit of the current admin and shop (desktop + mobile, light + dark) and list every problem, so each one is checked off in the rebuild.

## 7. Demo account

A public demo so people can try the admin without being able to break it.

- **Login**: `demo@admin.com` / `jkdvPfuPrpetttcS`. It is meant to be public: it goes in the README and on the admin login page ("Try the demo").
- **Role `demo`**: can open and look at **every** admin screen, but every change is refused with a clear message ("This is a demo: changes are disabled"). Enforced in `authorize()` on the server, not just by hiding buttons.
- **No emails** from the demo account (password reset, invites) and it can't change its own password.
- Created automatically when `DEMO_MODE=true` (with the password from `DEMO_ADMIN_PASSWORD`), together with sample data: categories, products with images, orders in every status, customers, messages.
- Optional **nightly reset** of the demo data on the public demo deployment.
- The storefront demo lets visitors place orders with cash on delivery or the test card, so the demo always has fresh orders to look at.

Note: `admin.com` is a real domain owned by someone else. That's fine as a login name since the demo account never receives email, but `demo@example.com` would be the safer choice; tell me if you'd prefer it.

## 8. Domains (Settings → Domains)

1. Owner adds `boutiquepence.com` (and chooses whether it's for the store or the admin).
2. The admin calls the hosting provider's API to attach it: **Railway** and **Vercel** supported, picked by env (`HOSTING_PROVIDER`, `HOSTING_API_TOKEN`, service ids). Without a token, the page still works and shows manual steps.
3. The page shows the DNS records to add at the registrar, with copy buttons.
4. Status updates automatically: Pending → Verified → SSL active (certificates are issued by the host).
5. Choose the **primary** domain; all others (www, the Railway address) redirect to it with a 301.

## 8b. Theme editor (Online store → Customize)

Shopify's "Edit code" relies on themes being template files read at runtime. This store is a compiled Next.js app, so editing its source from the admin isn't possible on a live server; instead the admin gets Shopify's **theme editor**:

- **Layout**: left panel with the page's sections, live preview of the store on the right (desktop / mobile toggle).
- **Sections and blocks** for the home page: announcement bar, hero (image/video, heading, buttons), featured products, collection list, image with text, rich text, testimonials, newsletter, trust badges. Add, remove, drag to reorder, hide; every section has its own settings and translated text (it/en/es).
- **Theme settings**: colors (background, text, accent, buttons), fonts (heading/body from a curated list), corner radius, button style, logo and favicon upload, social links.
- **Header and footer**: menu items (linked to the Navigation settings), footer columns.
- **Advanced (the safe "edit code")**: custom CSS, and custom HTML in `<head>` / before `</body>` for pixels and widgets, staff with `theme.edit` only.
- **Draft → Publish**: edits are saved as a draft and previewed; "Publish" makes them live (store pages revalidate at once). Previous published versions are kept for one-click rollback.
- Stored in the backend as JSON (`theme` + `theme_versions`), validated with Zod; every backend implements it.

## 9. Public repository

- Publish as a **fresh repository** (no old history): the old history contains the Nike/LuisaViaRoma scraper, which shouldn't be public.
- Secret scan before publishing; `.env*` stays ignored; `.env.example` per app and per backend.
- **MIT license**, README with: features, screenshots, live demo link + demo login, "Deploy on Railway" buttons for each backend, local setup guide per backend.
- `templates/` and scraping tools stay out of the repo (already ignored).
- Change the current Railway admin password before going public.

## 10. Phases

Each phase ends with `lint`, `typecheck`, `build` passing and a manual click-through; I report what was verified and what wasn't.

| # | Phase | Done when |
|---|---|---|
| 0 | **UI audit** of the current app → list of problems | you've seen the list |
| 1 | **Monorepo**: `apps/store`, `apps/admin`, `packages/core`, `packages/ui`, `packages/i18n`; current code moved; still on PocketBase | both apps run locally against today's PocketBase |
| 2 | **Backend interface** in `core`; PocketBase code becomes `backend-pocketbase` | apps only use the interface |
| 3 | **Supabase backend** (Kysely schema + migrations, Supabase Auth, Storage, RLS, seed) | full store + admin flow works on Supabase |
| 4 | **Admin design system + rebuild** of every admin screen; staff/roles screens; demo role | every audit item fixed; demo account read-only |
| 5 | **SQLite backend** (reuses the Kysely code, adds Better Auth + local files) | same flow works on a single SQLite file |
| 6 | **Domains** page + Railway/Vercel integration | domain added, verified and set primary on a test deployment |
| 6b | **Themes + theme editor**: template gallery (Atelier, Minimal, Bold, Classic), theme library, sections, theme settings, draft/publish, live preview (`docs/phase-6b-plan.md`) | a template picked, customized and published from the admin |
| 7 | **Deploy templates + docs + public repo**; live demo on Railway with `DEMO_MODE` | fresh public repo, demo URL working |
| 8 | **MCP server for Claude**: manage products, orders, settings and themes through the same actions and permissions | Claude edits and publishes a theme with a staff role |

Phases 3 and 5 are the largest. The uncommitted Customers work from today is included in phase 1.

## 11. Decisions I need from you

1. Demo login email: `demo@admin.com` (as asked) or `demo@example.com`?
2. Repo name and GitHub owner for the public version (e.g. `prinnotech/storefront-template`)?
3. Hosting for the official live demo: Railway with Supabase (recommended), or Railway with PocketBase like today?
