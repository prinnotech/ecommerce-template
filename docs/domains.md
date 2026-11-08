# Custom domains

Admin → **Settings → Domains** connects your own domain to the store or the admin, shows the DNS records to create, follows the status (**Waiting for DNS → Verifying → Active**) and lets you pick a **primary** domain per app. Every other address of that app (the hosting address, `www`, older domains) then answers with a **301 redirect** to the primary, keeping the path.

## 1. Choose how domains are attached

Set these in **both** apps' environment (the admin attaches domains; the store only reads the primary).

### Railway

```
HOSTING_PROVIDER=railway
HOSTING_API_TOKEN=          # Account settings → Tokens (or a workspace token)
RAILWAY_PROJECT_ID=         # Project settings → General
RAILWAY_ENVIRONMENT_ID=     # usually "production": the id is in the environment's settings URL
RAILWAY_STORE_SERVICE_ID=   # the store service → Settings
RAILWAY_ADMIN_SERVICE_ID=   # the admin service → Settings
```

Railway gives a **CNAME** (or, for a root domain like `example.com`, an ALIAS/ANAME/flattened CNAME) plus a **TXT** record to prove you own the domain. Both are needed. Railway has no fixed IP, so `A` records don't work.

### Vercel

```
HOSTING_PROVIDER=vercel
HOSTING_API_TOKEN=          # Account settings → Tokens
VERCEL_TEAM_ID=             # only for team projects
VERCEL_STORE_PROJECT_ID=    # Project → Settings → General → Project ID
VERCEL_ADMIN_PROJECT_ID=
```

Vercel gives an **A** record for a root domain or a **CNAME** for a subdomain, and sometimes a **TXT** record when the domain is already used in another Vercel account.

### Manual: any other host (no token)

Railway and Vercel are only shortcuts that attach the domain for you. On any other host (Render, Fly.io, Netlify, Coolify, a VPS behind Caddy/nginx…) leave `HOSTING_PROVIDER` empty and set where each app's DNS should point: the app's hostname on that host, or your server's IPv4 address.

```
HOSTING_STORE_TARGET_HOST=my-store.onrender.com    # a hostname → CNAME (ALIAS for a root domain)
HOSTING_ADMIN_TARGET_HOST=203.0.113.10             # an IPv4 address → A record
```

Add the domain in your host's dashboard yourself too (on your own server: in the reverse proxy, which also gets the HTTPS certificate). The Domains page records it, shows the record to create and marks it **Active** once DNS points at the app. Primary-domain redirects work the same on every host: they run in the apps themselves.

If `HOSTING_PROVIDER` is set but a variable is missing, the page says which and uses manual mode until it's fixed.

## 2. Connect a domain

1. **Connect domain**, type it (`shop.example.com` or `example.com`), choose **Store** or **Admin**.
2. Create the records shown at the company where you bought the domain. Every value has a copy button.
3. Wait. The page checks every 30 seconds while a domain is pending (or press **Check now**). DNS changes take from a few minutes to 48 hours; the host then issues the HTTPS certificate.
4. When it's **Active**, choose **Set as primary** in its menu. Redirects start within a minute (the apps cache the setting for 60 s).

**Stop redirecting** (under each app's list) removes the primary without deleting anything. The primary domain can't be removed until another one is primary or redirects are stopped.

## 3. After changing the primary

Links in emails, canonical URLs and the sitemap use `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_ADMIN_URL`, which are fixed at build time. Update them to the new domain and redeploy. Until then the redirect sends visitors to the right place.

## What's never redirected

`localhost`, IP addresses, `*.local`, `*.internal`, Railway's health check (`healthcheck.railway.app`) and Vercel preview deployments, so development, health checks and previews keep working.
