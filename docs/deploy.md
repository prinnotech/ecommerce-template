# Deploy

A store is two Next.js apps (store and admin) and a backend. Pick one setup:

| Setup | Services | Good for |
|---|---|---|
| **Railway + PocketBase** | `pocketbase`, `store`, `admin` | The simplest: everything on Railway, data in one volume |
| **Railway (or Vercel) + Supabase** | `store`, `admin` + a Supabase project | Managed Postgres, auth and storage |
| **One server + SQLite** | store and admin on the same machine | A VPS or Docker Compose; the two apps share the `data/` folder |

SQLite needs the store and the admin to share one folder, so it doesn't fit two separate Railway services (a Railway volume attaches to one service).

## Railway + PocketBase

Create a Railway project and add three services from this repository.

### 1. `pocketbase`

| Setting | Value |
|---|---|
| Variable `RAILWAY_DOCKERFILE_PATH` | `pocketbase.Dockerfile` |
| Volume | mounted at `/pb/pb_data` |
| Public domain | generate one (the apps and the browser call it) |

Variables:

```
POCKETBASE_SUPERUSER_EMAIL=you@example.com
POCKETBASE_SUPERUSER_PASSWORD=<10+ characters>
STORE_ADMIN_EMAIL=owner@example.com
STORE_ADMIN_PASSWORD=<8+ characters>
PB_APP_URL=https://<store domain>
```

On the first start PocketBase applies `pb_migrations/` and creates both accounts. Accounts that already exist are left alone, so changing these variables later doesn't change passwords. Change passwords from the admin (Settings → Profile) and the PocketBase dashboard (`/_/`).

### 2. `store` and 3. `admin`

The same image for both, one variable apart:

| Setting | `store` | `admin` |
|---|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `app.Dockerfile` | `app.Dockerfile` |
| `APP` | `store` | `admin` |
| Health check path | `/api/health` | `/api/health` |
| Public domain | the shop, for example `shop.example.com` | for example `admin.example.com` |

Variables for both (on Railway, use reference variables like `${{pocketbase.POCKETBASE_SUPERUSER_EMAIL}}` instead of copying):

```
BACKEND=pocketbase
NEXT_PUBLIC_SITE_URL=https://<store domain>
NEXT_PUBLIC_ADMIN_URL=https://<admin domain>
NEXT_PUBLIC_POCKETBASE_URL=https://<pocketbase domain>
POCKETBASE_SUPERUSER_EMAIL=${{pocketbase.POCKETBASE_SUPERUSER_EMAIL}}
POCKETBASE_SUPERUSER_PASSWORD=${{pocketbase.POCKETBASE_SUPERUSER_PASSWORD}}
THEME_PREVIEW_SECRET=<the same random text, 16+ characters, on both>
```

`NEXT_PUBLIC_*` values are built into the apps, so redeploy both after changing a domain.

Deploy `pocketbase` first, then the two apps. Sign in at `https://<admin domain>/login` with `STORE_ADMIN_EMAIL`.

## Supabase

1. Create the Supabase project and run `npm run db:setup` once from your computer, as described in [supabase.md](supabase.md). It creates the tables, the storage bucket and your admin account.
2. Deploy `store` and `admin` as above (Railway with `app.Dockerfile`, or Vercel). Variables for both:

```
BACKEND=supabase
NEXT_PUBLIC_SITE_URL=https://<store domain>
NEXT_PUBLIC_ADMIN_URL=https://<admin domain>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
DATABASE_URL=<transaction pooler connection string>
THEME_PREVIEW_SECRET=<same on both>
```

3. In Supabase → Authentication → URL configuration, add the store and admin domains as redirect URLs.

## Vercel

Create two projects from this repository:

| Setting | store | admin |
|---|---|---|
| Root directory | `apps/store` | `apps/admin` |
| Framework | Next.js | Next.js |

Vercel installs the workspace from the repository root automatically. Variables are the same as for Railway. Use Supabase, or a PocketBase running on Railway (its public URL in `NEXT_PUBLIC_POCKETBASE_URL`).

## One server + SQLite

On a VPS (or with Docker Compose), run both apps on the same machine with:

```
BACKEND=sqlite
SQLITE_PATH=/srv/store/data/store.db
UPLOADS_DIR=/srv/store/data/uploads
STORE_ADMIN_EMAIL=… STORE_ADMIN_PASSWORD=…
RESEND_API_KEY=…   EMAIL_FROM=…   # password-reset emails
```

Run `npm run db:setup`, then `npm run build`, then `PORT=3000 npm run start:store` and `PORT=3001 npm run start:admin` behind a reverse proxy such as Caddy or nginx, which also handles HTTPS. More in [sqlite.md](sqlite.md).

## Optional

| Variable | What |
|---|---|
| `HOSTING_PROVIDER`, `HOSTING_API_TOKEN` and the `RAILWAY_*` / `VERCEL_*` ids | Connect domains from the admin ([domains.md](domains.md)). Admin only |
| `SETTINGS_ENCRYPTION_KEY` | 16+ random characters, the same on the store and the admin. Needed to save the Stripe keys and the SMTP password from the admin |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_PASSWORD` | Optional: the same secrets as env variables instead of the admin (env wins) |
| `CRON_SECRET` | Store only. Turns on the automatic abandoned-checkout email: schedule `GET https://<store>/api/cron/abandoned-checkouts` every 15–60 min with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron, Railway cron, or any scheduler) |
| `SLACK_ERROR_WEBHOOK` | Server errors posted to Slack |
| `DEMO_MODE=true`, `DEMO_ADMIN_PASSWORD` | A public demo: shows the demo login on the admin's sign-in page. Seed it with `npm run demo:seed` |

## After deploying

- Fill in Settings in the admin: store name and logo, contact, shipping rates, taxes, payment methods, legal pages.
- Optional: connect an AI assistant. Settings → API keys creates a key and shows the MCP address (`https://<admin>/api/mcp`). Add it to the assistant as a custom connector with the header `Authorization: Bearer <key>`. Set `NEXT_PUBLIC_ADMIN_URL` so the address shown is right.
- Card payments: Settings → Payments → Stripe (publishable and secret key), and in Stripe add a webhook to `https://<store>/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then paste its signing secret.
- Order emails: Settings → Email sending (your SMTP server, then "Send test"), and Settings → Notifications for the texts.
- Pick and customize a theme (Online store → Themes).
- Optionally connect your domain (Settings → Domains).
