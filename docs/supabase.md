# Running the store on Supabase

Supabase is the recommended backend: Postgres for the data, Supabase Auth for sign-in and Supabase Storage for images. The apps talk to Postgres directly from the server (never through Supabase's auto-generated REST API), so every table has Row Level Security switched on with no policies, except one: anyone may read site settings marked public (the store's default language).

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (the free plan is enough to start).
2. **Project Settings → API keys**: copy the **Publishable** key and the **Secret** key.
3. **Connect** (top bar) → **Transaction pooler**: copy the connection string and put your database password in it.

## 2. Configure the apps

In `.env.local` (root) and in `apps/store/.env.local` and `apps/admin/.env.local`:

```
BACKEND=supabase
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
STORE_ADMIN_EMAIL=you@example.com
STORE_ADMIN_PASSWORD=at-least-8-characters
```

## 3. Create the tables and the admin account

```bash
npm run db:setup
```

It applies the migrations (tables, indexes, RLS, the `media` image bucket and the trigger that copies new sign-ups into `public.users`), then creates the store owner's login with admin access. Running it again is safe.

## 4. Auth settings (Supabase dashboard → Authentication)

- **URL Configuration**: Site URL = your store URL. Add both apps to **Redirect URLs**: `https://your-store.com/**` and `https://admin.your-store.com/**` (locally `http://localhost:3000/**` and `http://localhost:3001/**`).
- **Email Templates → Reset password**: make the link point to the page the app asks for (the store's new-password page for customers, the admin's for staff invites):
  `{{ .RedirectTo }}?token={{ .TokenHash }}`
- **Sign In / Providers → Email**: with **Confirm email** on (the default), new customers must click the email link before they're signed in.
- Set up a custom SMTP sender before going live; Supabase's built-in sender is rate-limited.

## 5. Run

```bash
npm run dev:store
```
```bash
npm run dev:admin
```

## Notes

- Images are public files in the `media` bucket. Resized thumbnails need Supabase image transformations (paid plans); set `SUPABASE_IMAGE_TRANSFORMS=true` if you have them, otherwise the original files are served.
- The schema lives in `packages/backend-sql/migrations.ts` and is shared with the SQLite backend. Change it there, never in the Supabase table editor.
