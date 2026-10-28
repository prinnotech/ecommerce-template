# Clothing store template

A resellable clothing store built with Next.js (App Router) and PocketBase. Every store-specific value (name, address, contact, currency, shipping, legal text) is a site setting edited from the admin dashboard.

## Admin accounts

Both admin accounts come from env variables and are created automatically the first time PocketBase starts (`pb_migrations/1793059208_bootstrap_admins.js`):

| Variables | Account |
|---|---|
| `POCKETBASE_SUPERUSER_EMAIL`, `POCKETBASE_SUPERUSER_PASSWORD` (10+ chars) | PocketBase superuser (`/_/` admin UI). Next.js uses the same two variables to reach the database. |
| `STORE_ADMIN_EMAIL`, `STORE_ADMIN_PASSWORD` (8+ chars) | Store owner's dashboard account (`/auth/login`, then `/dashboard`). |

Accounts that already exist are left untouched. To add or promote another admin later: `npm run create-admin -- <email> <password> "Name"`.

## Local setup

1. Put the PocketBase binary for your OS in the project root (`pocketbase.exe` on Windows, `pocketbase` elsewhere). It is git-ignored.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the four admin variables above.
4. `npm run pb`: applies `pb_migrations/` (creating both admins) and serves PocketBase on http://127.0.0.1:8090.
5. Optional: `npm run seed` for sample products, or import your own (see below).
6. `npm run dev` and open http://localhost:3000.

## Importing products from CSV

In the dashboard: **Products → Import CSV** (or **Categories → Import CSV**). The page has a "Download template" button, shows a preview, and imports with a progress bar.

From the command line instead:

1. Download the template from the import page and fill it in (one row per variant; rows with the same `handle` are one product).
2. With PocketBase running: `npm run import-products -- path/to/products.csv`

Columns:

| Column | Notes |
|---|---|
| `handle` | URL handle, lowercase with hyphens (`linen-shirt`). Same handle = same product. |
| `title_en`, `title_es`, `title_it` | At least one is required. |
| `description_en`, `description_es`, `description_it` | Optional. Use `\n` for line breaks. |
| `category` | Category handle (`women`). Created if it doesn't exist. |
| `price`, `compare_at_price` | In currency units (`59.00`). `compare_at_price` is the crossed-out price; leave empty for none. |
| `status` | `active`, `draft` or `archived` (default `draft`). |
| `featured` | `yes` / `no`. |
| `tags` | Separated by `|`. |
| `size`, `color`, `color_hex` | Variant options. `color_hex` like `#1c1c1c`. |
| `sku` | Unique per variant. Existing SKUs are updated, new ones created. |
| `variant_price` | Optional price for this variant only. |
| `stock` | Units in stock. |
| `image_urls` | On the product's first row: image URLs or local file paths, separated by `|`. Uploaded only when the product has no images yet. |

Product fields are read from the first row of each handle. Running the import again updates existing products and variants instead of duplicating them.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploy (Railway for PocketBase, Railway or Vercel for Next.js)

Only the schema ships: `pb_migrations/` and `pb_hooks/`. The database lives in a volume.

1. **PocketBase service** (Railway, from this repo):
   - Variable `RAILWAY_DOCKERFILE_PATH=pocketbase.Dockerfile`.
   - A volume mounted at `/pb/pb_data`.
   - Variables: the four admin variables above, and `PB_APP_URL` (your storefront URL).
   - Generate a public domain for it.
2. **Next.js service** (Vercel, or Railway from this repo):
   - Variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POCKETBASE_URL` (the PocketBase public URL), and the same `POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD` (on Railway, use reference variables).
3. Deploy PocketBase first, then Next.js.
4. Sign in at `https://your-store.com/en/auth/login` with `STORE_ADMIN_EMAIL` and change the password under My account → Profile.

See `CLAUDE.md` for the code conventions.
