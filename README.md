# Clothing store template

A resellable clothing store built with Next.js (App Router) and PocketBase. Every store-specific value (name, address, contact, currency, shipping, legal text) is a site setting edited from the admin dashboard.

## Local setup

1. Put the PocketBase binary for your OS in the project root (`pocketbase.exe` on Windows, `pocketbase` elsewhere). It is git-ignored.
2. `npm install`
3. Copy `.env.example` to `.env.local`.
4. Create a local superuser and put the same values in `.env.local`:
   ```bash
   ./pocketbase.exe superuser upsert <email> <password>
   ```
5. `npm run pb` (applies `pb_migrations/` and serves PocketBase on http://127.0.0.1:8090, admin UI at `/_/`).
6. `npm run create-admin -- <email> <password> "Store owner"`
7. Optional: `npm run seed` for sample products.
8. `npm run dev` and open http://localhost:3000.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploy

Only the schema ships: `pb_migrations/` and `pb_hooks/`. PocketBase runs on Railway with a volume for `pb_data`; Next.js runs on Vercel or Railway. See `CLAUDE.md` for the full conventions.
