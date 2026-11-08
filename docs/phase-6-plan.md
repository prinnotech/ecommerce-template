# Phase 6 plan: Domains (Settings → Domains)

**Status: built (2026-11-05).** Manual mode tested end to end on PocketBase (connect → active → primary → 301 → stop → remove). Railway and Vercel adapters not yet tested against the live APIs. See `docs/domains.md`.

Goal: the store owner connects their own domain from the admin, Shopify-style: add it, see the DNS records to create, watch it go from "Pending" to "Active", and pick the primary domain that every other address redirects to. Works with Railway or Vercel hosting; without a hosting token the page still works and shows the manual steps.

Done when lint, typecheck and build pass, and a real domain is added, verified and set primary on a test deployment (needs your domain and hosting token: see "What I need from you").

## How it works for the owner

1. **Add domain**: type `boutiquepence.com`, choose **Store** or **Admin**.
2. The admin asks the hosting provider to attach it and shows the **DNS records** to add at the registrar (type, name, value, each with a copy button), plus a link to "How to add DNS records".
3. **Status** updates by itself every 30 s while the page is open (and with a "Check now" button): **Pending DNS → Verifying → Active** (SSL issued by the host), or **Error** with the reason.
4. **Set as primary** (one per app). Every other address of that app (the `*.up.railway.app` one, `www`, older domains) gets a **301 redirect** to it.
5. **Remove** a domain (with confirmation). The primary can't be removed until another is primary.

## Decisions (proposed defaults — say if you want otherwise)

1. **Providers: Railway and Vercel**, picked with `HOSTING_PROVIDER` (`railway` | `vercel` | empty = manual). One small adapter per provider behind one interface, so Netlify/Fly/others can be added later.
2. **Manual mode** (no token): the domain is saved, the page shows the generic records (CNAME to `HOSTING_TARGET_HOST`, e.g. your Railway address) and the steps to add the domain in the host's dashboard; status is checked with a DNS lookup only.
3. **Who can manage domains**: anyone with `settings.edit` (no new permission). The demo can see the page; changes are refused like everywhere else.
4. **Redirect to primary** happens in each app's `proxy.ts`, using a public setting (`PRIMARY_DOMAIN_STORE` / `PRIMARY_DOMAIN_ADMIN`) the proxy already knows how to read (cached 60 s). `localhost` and preview hosts are never redirected.
5. **Canonical URLs**: `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_ADMIN_URL` stay the source for links and emails (they're baked into the build). The page reminds you to update them after the primary changes; the redirect covers traffic in the meantime.

## Data (all three backends)

New `domains` table / collection (migration `0005_domains` + `pb_migrations/1793059210_domains.js`, locked to the server like `payments`):

| Field | |
|---|---|
| `hostname` | lower-case, unique |
| `target` | `store` \| `admin` |
| `is_primary` | one per target |
| `status` | `pending` \| `verifying` \| `active` \| `error` |
| `dns_records` | json: `[{ type, name, value }]` from the provider |
| `provider_ref` | the provider's id for the domain |
| `last_error`, `last_checked_at` | |

Backend contract: `domains.list/get/create/update/remove/setPrimary`.

## Code

- `packages/core/lib/hosting/`: `types.ts` (adapter interface: `attach`, `check`, `detach`), `railway.ts` (Railway public GraphQL API: `customDomainCreate`, `customDomain` status, `customDomainDelete`), `vercel.ts` (REST: add project domain, domain config + verify, remove), `manual.ts` (DNS lookup with `node:dns`), `index.ts` (`getHostingProvider()` from env).
- `packages/core/actions/domains.ts`: `getDomains`, `addDomain`, `checkDomain`, `setPrimaryDomain`, `removeDomain` — authorize (`settings.view` / `settings.edit`) → validate hostname (Zod, no IPs/localhost) → provider → backend → activity log.
- `apps/admin/app/(admin)/settings/(sections)/domains/`: replaces the placeholder with the index table (hostname, app, status badge, primary), an "Add domain" dialog, a detail drawer with the DNS records and copy buttons, auto-refresh while pending.
- `proxy.ts` (both apps): 301 to the primary domain.
- `.env.example` + `docs/domains.md`: the env vars per provider and how to create the tokens.
- Dictionary text in en/es/it.

## Env vars (new)

```
HOSTING_PROVIDER=railway          # railway | vercel | (empty = manual)
HOSTING_API_TOKEN=                # server only
HOSTING_TARGET_HOST=              # manual mode: where DNS should point
# Railway
RAILWAY_PROJECT_ID= RAILWAY_ENVIRONMENT_ID= RAILWAY_STORE_SERVICE_ID= RAILWAY_ADMIN_SERVICE_ID=
# Vercel
VERCEL_TEAM_ID= VERCEL_STORE_PROJECT_ID= VERCEL_ADMIN_PROJECT_ID=
```

## What I need from you (for the final test, not to build it)

- A domain or subdomain you can point at the test deployment (e.g. `shop-test.yourdomain.com`) and access to its DNS.
- A Railway API token (or Vercel) for the test project. The current Railway deployment still runs the old single-app version, so testing also needs the two apps deployed (that's phase 7's Railway reconfiguration; I can do that part first if you prefer).

## Order of work

1. Migration + backend contract (all three backends), types regenerated, migrations run on throwaway databases.
2. Hosting adapters + actions + manual mode.
3. Domains screen.
4. Primary redirects in both proxies.
5. Docs, dictionaries, lint/typecheck/build; then the live test once you give me a domain and token.
