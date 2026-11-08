# Running the store on SQLite

The smallest setup: one database file, a local folder for images, and sign-in built into the store. Nothing else to run or pay for.

**Limit:** the store and the admin must run **on the same server**, because they share the database file and the images folder. That works on a VPS (or one container running both apps). It doesn't work as two separate cloud services each with its own disk; use Supabase for that.

## 1. Configure

In `.env.local` (root) and in `apps/store/.env.local` and `apps/admin/.env.local`:

```
BACKEND=sqlite
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Optional: where the database and images live (defaults: data/store.db and data/uploads)
SQLITE_PATH=
UPLOADS_DIR=
# Password-reset emails through Resend (resend.com). Without them the link is written to the server log.
RESEND_API_KEY=
EMAIL_FROM=Store <shop@yourdomain.com>
STORE_ADMIN_EMAIL=you@example.com
STORE_ADMIN_PASSWORD=at-least-8-characters
```

## 2. Create the database and the admin account

```bash
npm run db:setup
```

Applies the migrations and creates the store owner's login with admin access. Safe to run again.

## 3. Run

```bash
npm run dev:store
```
```bash
npm run dev:admin
```

## Notes

- Requires Node.js 22.13 or newer (it uses Node's built-in `node:sqlite`, no native packages).
- Back up `data/` (database + images) regularly. While the apps run, copy the database with `sqlite3 data/store.db ".backup backup.db"` rather than copying the file.
- Images are served by both apps at `/media/…`.
- Sign-in: passwords are hashed with scrypt; sessions last 30 days; password-reset links are single-use and expire after an hour. Changing the password signs out the customer's other devices.
