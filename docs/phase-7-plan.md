# Phase 7 plan: public repository, deploy templates and live demo

**Status: Part A done (2026-11-06), Part B waiting for a yes.** Screenshots moved to after the demo deploy (a production build with product photos). Decisions: repo `prinnotech/storefront-template`, public; live demo on Railway + PocketBase; demo login `demo@admin.com`; MIT license, copyright holder "prinnotech".

Goal: anyone can find the template on GitHub, try a live demo (store + read-only admin), and deploy their own copy on Railway in a few clicks, with any of the three backends.

## Part A: local work (nothing leaves this computer)

1. **Secret scan.**
   - Go through every file that would be published, and the current repo's history, for tokens, passwords, keys and private URLs.
   - Anything found is removed. If a real credential was ever committed, it's listed for you to rotate.
2. **Publish list.** Exactly which files go public. Out:
   - `templates/` and the scraping tools
   - `pb_data/`, `data/`, `.env*` (except `.env.example`)
   - logs, `pocketbase.exe`
   - `AGENTS.md`, unless you want it in
3. **Docs:**
   - **README rewrite:** what it is, features, screenshots, the live demo link with the demo login, deploy buttons, and local setup for PocketBase, Supabase and SQLite.
   - **LICENSE:** MIT.
   - **`.env.example`** per app (store, admin), grouped per backend.
   - The existing `docs/` (supabase, sqlite, domains, themes) cleaned up for outside readers. The internal plans (`phase-*`, `ui-audit`) move to `docs/internal/` or stay out.
4. **Deploy config (Railway):**
   - One config file per service: store, admin, PocketBase. Build and start commands for the npm workspaces, health checks.
   - A `docs/deploy-railway.md` with the exact variables per service and per backend.
   - The same for Vercel (two projects) in short form.
5. **Demo data:** `npm run demo:seed` also creates themes (a published Atelier and a draft Bold), a custom page (Size guide with an FAQ) and a menu, so the demo shows phases 6b/6c. Optional nightly reset (`demo:reset`) as a Railway cron service.
6. **Screenshots** for the README, taken from a local demo: home, product page, checkout, admin dashboard, orders, theme editor. Light mode, 1440 px wide.
7. Lint, typecheck and build. Then a final check of the publish list.

## Part B: outward-facing (each step needs your explicit yes when we get there)

8. **Fresh public GitHub repository.**
   - It's a new repo with a single first commit, built from the publish list in a separate folder.
   - The current repo (`prinnotech/ecommerce-template`, with the old history) is not touched or pushed.
9. **Railway live demo**, in the existing `ecommerce-template` project:
   - Replace the old `web` service with `store` and `admin` services from the new repo.
   - Keep `pocketbase` (new migrations apply on deploy), or switch the demo to Supabase if you choose that.
   - Set `DEMO_MODE`, `THEME_PREVIEW_SECRET` and the domains, then seed the demo data.
   - **Before it goes public:** change the current Railway store-admin and superuser passwords (you set the new ones in Railway; I don't read them).
10. **Deploy buttons.** A Railway template per backend (PocketBase = 3 services, Supabase/SQLite = 2–3) made from the public repo. Railway templates are created in the Railway dashboard. I'll prepare everything and walk you through the clicks, or do it with the Railway tools where they allow it. Then the buttons go in the README.

## Needs your decisions

1. **Repo:** name and owner (suggestion: `prinnotech/storefront-template`), and public right away or private first, to look it over.
2. **Live demo backend:** Railway + PocketBase (already running, cheapest, one more service) or Supabase.
3. **Demo login email:** `demo@admin.com` (as you asked) or `demo@example.com`. `admin.com` is someone else's real domain; the account never sends email, so either works.
4. **License holder name** for the MIT license (for example "prinnotech" or your company name).

Part A starts once you've answered; nothing in Part B happens without a separate yes.
