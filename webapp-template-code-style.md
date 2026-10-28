# Web App Code Style — Next.js

**Version 2.3 · 2026-10-24** · Master copy: `webapp-template-code-style.md` in the template repo. Claude Code loads a copy from `~/.claude/`. After editing the master, copy it there. See the changelog at the end.

These are the rules for building and changing a Next.js web app in this style. They apply to **every Next.js app**, whether it's new or old.

**The template repo is a component library, not a starter.** Apps start small with `create-next-app` and pull in only the pieces they need from the template (see "Starting a new app" below). The template holds the reference implementation of every pattern in this document.

**For the AI:** these rules override your defaults. When existing code disagrees with this document, follow the document for new code and mention the gap. Don't rewrite unrelated code without being asked. When a rule doesn't cover a case, pick the option most consistent with the rest of this document and say which one you picked. **Before building a feature, look at how the template does it and copy that shape (see "Starting a new app").**

---

## Hard rules: never do this

1. Never use `getSession()` on the server to decide who the user is.
2. Never use the service client (`createServiceSupabase`) before authorizing the caller.
3. Never trust a user id, role, price or total sent from the client.
4. Never put a secret in a `NEXT_PUBLIC_` variable or in a client component.
5. Never add a table without RLS.
6. Never edit `types/supabase-types.ts` by hand.
7. Never use `any`.
8. Never put `"use client"` on a page or layout.
9. Never fetch data with `useEffect` + `useState`. Use a Server Component or TanStack Query.
10. Never put server data in Zustand.
11. Never hard-code user-facing text. Use the dictionary.
12. Never create an `app/api/` route for something only our own UI calls. Use an action (tracking beacons are the exception, §8).
13. Never use raw colors. Use theme tokens.
14. Never commit `console.log`, commented-out code, `.env.local` or credential files.
15. Never export anything except async functions from a `"use server"` file.
16. Never put a `loading.tsx` above a layout that runs an auth guard.
17. Never hard-code a value an admin should be able to change (site name, currency, default language, contact details, fees, legal text). Make it a site setting (§12).

---

## How the AI works in this codebase

**Before writing**
- Read the neighbouring code and the reference feature first, and copy its patterns.
- For a change that touches more than ~3 files, the database schema, auth or payments, give a short plan and wait for an OK.

**Ask first, in chat, before you:**
- add, remove or upgrade a dependency
- create or apply a migration, or change RLS policies
- run any SQL or MCP write against a remote database (Supabase, Vercel, Stripe, …)
- delete or rename files
- change auth, permissions, env vars or anything that sends emails, payments or messages

**Never:**
- run destructive SQL (`drop`, `truncate`, `delete`/`update` without `where`) against a shared or production database
- commit or push unless asked
- disable a lint rule, type check or test to make an error go away

**While working**
- Schema changes follow this order: migration in `supabase/migrations/` → apply locally or on a branch → regenerate `types/supabase-types.ts` → update schemas, actions and hooks.
- Keep the change scoped to the request. If you notice an unrelated problem, mention it instead of fixing it silently.
- If a request conflicts with this document, say so and ask which to follow.

**Done means**
- `npm run lint`, `npm run typecheck` and `npm run build` pass.
- New user-facing text exists in every dictionary (`en`, `es`, `it`).
- Your summary says what you verified and what you didn't (for example: "not clicked through in the browser", "migration not applied").

---

## Starting a new app

**Template location:** `D:\Projects\nextjs-app-template` (GitHub: `prinnotech/nextjs-app-template`). Read files from there. Don't write a pattern from memory when the template already has it.

### 1. Create the app
`npx create-next-app@latest` with TypeScript, Tailwind, ESLint and the App Router. Then turn on the React Compiler and add only the stack pieces (§1) the app actually uses.

### 2. Copy the foundation
Every app gets these from the template, copied as they are:
- **Rules and tooling:** a short `CLAUDE.md` with app-specific notes only (these rules already load from `~/.claude/`), `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.claude/settings.json` + `.claude/hooks/lint-file.mjs`, `.env.example` (trimmed to what's used), plus the `lint`, `typecheck` and `format` scripts.
- **Core:** `lib/action-result.ts`, `lib/server-log.ts`, `lib/site-config.ts`, `lib/utils.ts`, `lib/utils/format.ts`, `providers/query-provider.tsx`, `providers/theme-provider.tsx`.

### 3. Add pieces only when a feature needs them
| Need | Copy from the template |
|---|---|
| Database | `lib/supabase/*`, `types/supabase-types.ts` (then regenerate), `supabase/migrations/` you need |
| Sign-in | `lib/auth.ts`, `app/[lang]/auth/*`, `providers/auth-listener.tsx`, `store/auth-store.ts`, `components/password-input.tsx`, the team_members migration |
| Site settings | `lib/site-settings.ts`, `lib/site-settings-server.ts`, `lib/site-settings-proxy.ts` (if the proxy needs a setting), `lib/schemas/site-settings.ts`, `app/actions/site-settings.ts`, `hooks/use-site-settings.ts`, `app/[lang]/dashboard/settings`, the site_config migration |
| Roles and team screens | `lib/permissions.ts`, `lib/activity-log.ts`, `app/actions/{roles,team,activity,access}.ts`, `hooks/use-{permissions,roles,team}.ts`, `components/can.tsx`, `app/[lang]/dashboard/{roles,users,activity}`, the roles and activity_log migrations |
| Dashboard shell | `app/[lang]/dashboard/layout.tsx`, `components/dashboard/*`, shadcn `sidebar` |
| Languages | `i18nConfig.ts`, `lib/i18n.ts`, `lib/locale/*`, `dictionaries/`, `components/language-switcher.tsx`, the locale part of `proxy.ts` |
| Ad tracking / Meta | `lib/tracking/*`, `components/tracking/*`, `app/api/tracking/meta`, the tracking part of `proxy.ts` |
| Payments | `lib/stripe/*`, `app/actions/checkout.ts`, `lib/schemas/checkout.ts`, `app/api/stripe/webhook`, `app/[lang]/checkout/*`, `store/checkout-store.ts`, the payments migration |
| Currency display | `lib/fx.ts`, `app/actions/currency.ts`, `hooks/use-currency.ts`, `store/currency-store.ts`, `providers/currency-detector.tsx`, `components/language-currency-switcher.tsx` |
| Heatmap | `components/heatmap-collector.tsx`, `app/api/tracking/heatmap`, `app/actions/heatmap.ts`, the heatmap migration |
| Components | `phone-field`, `google-places-input`, `signature-pad`, `cookie-consent`, `concierge` (+ its action), `theme-toggle` in `components/` |

When you copy a piece:
- Copy the **whole set** in its row (and the dictionary keys it uses), keeping file names and locations.
- Remove what this app doesn't use, rather than leaving dead code.
- If a file this document mentions doesn't exist yet in the app, copy it from the template instead of writing a new version.
- Single-language app: skip the Languages row and the `[lang]` segment, but still keep text in one dictionary file.

### 4. Feed new components back
When you build something reusable in an app (not tied to one business), offer to add it to the template:
- generic: no project names, ids or URLs; config comes from env
- translated: en/es/it
- lint clean
- added to the table above

Business-specific code stays in the app.

---

## 1. Stack

Always use the **latest stable version** of each package. Don't pin to old majors, and don't use APIs a newer major has deprecated.

| Area | Choice |
|---|---|
| Framework | Next.js App Router, `proxy.ts` (not `middleware.ts`) |
| UI runtime | React with the React Compiler on (`reactCompiler: true`) |
| Language | TypeScript, `strict: true` |
| Styling | Tailwind CSS v4, `tw-animate-css` |
| Components | shadcn/ui on Radix, `lucide-react`, `sonner`, `next-themes` |
| Backend | Supabase: Postgres, Auth, Storage (`@supabase/ssr` + `@supabase/supabase-js`) |
| Server state | TanStack Query |
| Client state | Zustand |
| Validation | Zod |
| i18n | `next-i18n-router` with an `app/[lang]` segment |
| Payments | Stripe (Checkout Sessions with Elements + webhook) |
| Tracking | GTM / Google tag, Meta Pixel + Conversions API, UTM capture, optional heatmap |
| Hosting | Vercel, `@vercel/analytics`, `@vercel/speed-insights` |
| Package manager | npm |

Don't add a dependency the stack already covers. If one is really needed, say why.

The React Compiler is on: **don't add `useMemo`, `useCallback` or `React.memo`** for performance, only when a library needs a stable reference.

---

## 2. Project structure

This is the template's full layout. A new app only has the folders it uses, but with these same names and places.

```
app/
  [lang]/
    layout.tsx                  # html, fonts, providers, tracking, cookie banner
    page.tsx · not-found.tsx
    auth/                       # login, register, reset-password, new-password, error, callback/route.ts
    dashboard/
      layout.tsx                # server-side auth guard (requireCaller + dashboard.view)
      loading.tsx · error.tsx
      roles/ · users/ · activity/ · settings/   # roles matrix, team, activity log, site settings
      notes/                    # ← REFERENCE FEATURE
        page.tsx                #   server prefetch + HydrationBoundary
        components/             #   note-form.tsx, notes-list.tsx (route-only components)
    checkout/                   # Stripe checkout + success/
  actions/                      # ALL server actions, one file per domain
  api/                          # route handlers only for callers outside our UI (§7)
  global-error.tsx · robots.ts · sitemap.ts
components/
  ui/                           # shadcn (generated)
  dashboard/                    # sidebar, nav, breadcrumb
  tracking/                     # tracking-scripts.tsx, page-view-tracker.tsx
  *.tsx                         # shared components (phone-field, cookie-consent, …)
hooks/                          # use-*.ts: TanStack wrappers and UI hooks
lib/
  supabase/                     # supabase-server.ts, supabase-client.ts, supabase-proxy.ts
  schemas/                      # Zod schemas per domain (shared by forms and actions)
  tracking/                     # UTM capture, Meta (browser + CAPI), Google Ads
  locale/                       # locale detection, languages, currencies, countries
  stripe/stripe-server.ts
  auth.ts · permissions.ts · activity-log.ts · action-result.ts · query-keys.ts · i18n.ts
  site-settings.ts · site-settings-server.ts · site-settings-proxy.ts   # site settings (§12)
  build-page-metadata.ts · site-config.ts · server-log.ts · slack.ts · fx.ts
  utils.ts (cn) · utils/format.ts (Intl formatting)
providers/                      # query, theme, auth listener, currency detector
store/                          # Zustand stores: *-store.ts
types/supabase-types.ts         # GENERATED
dictionaries/                   # en.json, es.json, it.json (always)
supabase/migrations/            # SQL migrations: the source of truth for the schema
proxy.ts · i18nConfig.ts · .env.example
```

**The reference feature is `notes` (in the template).** It shows the whole path once: migration with RLS (`supabase/migrations/…_notes.sql`) → types → schema (`lib/schemas/notes.ts`) → actions (`app/actions/notes.ts`) → hooks (`hooks/use-notes.ts`) → query keys → prefetching page → client form and list → dictionary keys. **New features copy this shape.**

Rules:
- **Colocate.** A component used by one route lives in that route's `components/`. It moves to `components/` when a second route needs it.
- **Group by domain.** `app/actions/bookings.ts` holds every booking action.
- Keep `page.tsx` thin: fetch or prefetch, then render.
- No `context/` folder: client-wide state is Zustand, React providers go in `providers/`.
- No versioned copies (`*-old.tsx`, `v2/`). Use branches.

---

## 3. Naming

| What | Convention | Example |
|---|---|---|
| Files and folders | `kebab-case` | `booking-drawer.tsx`, `use-bookings.ts` |
| Variables, parameters | `snake_case` | `const total_amount = …` |
| Our own object keys and props | `snake_case` | `{ booking_id }`, `<NavUser sign_out_label=… />` |
| Functions (including actions) | `camelCase` | `getBookings()`, `formatCurrency()` |
| Callback props | `camelCase`, `on…` | `onSave`, `onValueChange` |
| Components | `PascalCase` | `BookingDrawer` |
| Hooks | `useCamelCase` | `useBookings()` |
| Types | `PascalCase` | `Booking`, `CreateNoteInput` |
| Zod schemas | `snake_case_schema` | `create_note_schema` |
| Module constants, env vars | `UPPER_SNAKE_CASE` | `MAX_GUESTS`, `STRIPE_SECRET_KEY` |
| Zustand stores | `use…Store` in `…-store.ts` | `useCartStore` |
| DB tables / columns | `snake_case`, plural tables | `bookings.check_in` |
| Dictionary keys | `snake_case`, nested by page | `dictionary.auth.login.forgot_password` |

**Values are `snake_case`, anything you call is `camelCase`, components and types are `PascalCase`.** ESLint enforces this (§21).

Library-owned names keep their casing: `className`, `onClick`, `queryKey`, `isPending`, destructured results. DB rows flow through the app **without mapping**, because columns are already `snake_case`.

Booleans start with `is_`, `has_`, `can_`, `should_`. Use named exports, except where Next requires a default export.

---

## 4. Server vs client components

**Server Components are the default.** Add `"use client"` only for state/effects, event handlers, browser APIs or client-only libraries, and put it on the **smallest leaf**, never a page or layout.

- Pass server content into client components as `children`.
- Props crossing the boundary must be serializable. Icons (components) can't be passed from server to client: keep icon config inside the client component (see `components/dashboard/app-sidebar.tsx`).
- Server-only files start with `import "server-only";`. **Not** in anything `proxy.ts` imports, because the proxy can't load it.
- Client components get text from a typed `dictionary` prop. Error boundaries (`error.tsx`) are the exception: they can't receive props, so they import the small slices they need (see `app/[lang]/dashboard/error.tsx`).
- Components using `useSearchParams()` are wrapped in `<Suspense>`.

---

## 5. Pages and layouts

Pattern: `app/[lang]/auth/login/page.tsx`.

- `params` and `searchParams` are **Promises**: `await` them.
- Every public page exports `generateMetadata` using `buildPageMetadata` (canonical, hreflang for every locale, OpenGraph). Private pages set `robots: { index: false }`.
- Routes with async data get a `loading.tsx` (skeleton) **below** any guarded layout, and an `error.tsx`. **Never put `loading.tsx` above a layout that calls `requireCaller`**: the Suspense boundary starts streaming first and the redirect degrades from a 307 to a client-side refresh.
- Call `notFound()` for missing records.
- Add every public route to `app/sitemap.ts`.

---

## 6. Data fetching

| Situation | Use |
|---|---|
| First-render data, read-only on that page | Server Component calling an action |
| Data the client re-fetches, filters or mutates | TanStack hook in `hooks/`, prefetched on the server when above the fold |
| Pure UI state | Zustand |
| State that should survive refresh or be shareable | URL search params |

**Never put server data in Zustand.**

TanStack Query is mounted once in `app/[lang]/layout.tsx` (`providers/query-provider.tsx`).

- All query keys come from `lib/query-keys.ts`.
- Hooks wrap actions with `unwrap()`, which turns `ActionResult` into data or a thrown error (`hooks/use-notes.ts`).
- Prefetch on the server with `QueryClient` + `HydrationBoundary` (`app/[lang]/dashboard/notes/page.tsx`).
- After a mutation, **invalidate** the affected keys.
- Use `enabled` for dependent queries.
- Server actions run one at a time per client. For many parallel reads, prefetch on the server with `Promise.all`.

---

## 7. Server actions and route handlers

**Default: server actions in `app/actions/<domain>.ts`.** Use `app/api/` only for webhooks, third parties, cron, non-JSON responses (images, files), and tracking beacons.

Every action follows the same order: **authenticate → authorize → validate → work → return `ActionResult`.** Copy `app/actions/notes.ts`.

- **Every exported function in a `"use server"` file is a public HTTP endpoint.** Check auth and permissions inside it.
- **A `"use server"` file may only export async functions.** Zod schemas live in `lib/schemas/<domain>.ts` and are imported by both the form and the action.
- **Never trust identity from the client.** The acting user comes from `getCaller()`.
- Validate every input with Zod.
- Return `ActionResult<T>` (`lib/action-result.ts`): `ok(data)` or `fail(code)`. **Error codes are keys of `dictionary.errors`** (`"not_signed_in"`, `"forbidden"`, `"invalid_input"`, `"not_found"`, `"generic"`, …), so every error is translated. The client shows `errors[result.error]`, or `errorText(errors, error)` for errors thrown by `unwrap`.
- Raw errors go to `reportError()`, never to the client.
- Select explicit columns when the result goes to the client.
- Public actions (checkout, lead forms) still validate, never accept prices, and are safe to call repeatedly.
- Server-only helpers that aren't endpoints go in `lib/`, not `app/actions/`.

Route handlers verify signatures first (`app/api/stripe/webhook/route.ts`), validate with Zod, and return proper status codes.

---

## 8. Proxy, tracking and Meta

### `proxy.ts`
It does three things, in order, and nothing else (no permission decisions):
1. **Locale routing** with `next-i18n-router`. A visitor without a locale in the URL is redirected using browser language, then IP country (`lib/locale/detect-locale.ts`), then the `DEFAULT_LOCALE` site setting (§12).
2. **Tracking capture** (`lib/tracking/capture-tracking.ts`). Every UTM, extended campaign param and ad click id (Google, Meta, TikTok, Microsoft, LinkedIn, Pinterest, X, Snapchat, Reddit, Yahoo) is merged into the `utm` cookie for 90 days. Last touch wins per key; `landing_page`, `referrer` and `first_seen_at` are kept from the first touch. `fbclid` also sets Meta's `_fbc` cookie. `/auth/*` pages are skipped. Bundled `?ads=` / `?adsMetadata=` JSON is accepted.
3. **Session refresh** (`lib/supabase/supabase-proxy.ts`), only when an auth cookie exists.

The param list lives in `lib/tracking/tracking-params.ts`: add new ad networks there.

### Using the attribution
- **Server:** read `cookies().get(TRACKING_COOKIE)` with `parseTrackingCookie()` and attach it to whatever you create (orders, leads). The checkout already puts it in Stripe metadata.
- **Browser:** `readTrackingCookie()`.

### Meta
- **Browser events:** `lib/tracking/meta.ts` (`trackMetaEvent`, `trackMetaLead`, `trackMetaPurchase`, `trackMetaCustomEvent`, …). Each call fires the Pixel **and** `/api/tracking/meta` (Conversions API) with the **same `event_id`**, so Meta deduplicates and still counts the event if the Pixel is blocked.
- **Server events:** `sendMetaEvent()` from `lib/tracking/meta-capi.ts` (hashes PII, adds IP, user agent and geo).
- **Purchases** are sent from the Stripe webhook with `event_id = Stripe session id`. The success page fires the browser Purchase with the same id.
- `/api/tracking/meta` is a route handler on purpose: actions are serialized per client and tracking would delay real UI actions.
- PageView: the Pixel snippet sends the first one, `components/tracking/page-view-tracker.tsx` sends the rest on client navigation.

### Google
- GTM and the Google tag load from env ids (`components/tracking/tracking-scripts.tsx`).
- Conversions: `trackGoogleAdsConversion({ label, value, currency, transaction_id })` from `lib/tracking/google-ads.ts`.

### Heatmap
Set `NEXT_PUBLIC_HEATMAP_ENABLED=true`. Events go to `/api/tracking/heatmap` → `heatmap_events`. Read them with `getHeatmapData()` (requires `analytics.view`).

### Consent
`components/cookie-consent.tsx` stores the choice. Read it with `useCookieConsent()`. For EU traffic, decide per project whether marketing pixels wait for consent, and gate them on this hook.

All tracking ids are env variables. Nothing is hard-coded.

---

## 9. Database (Supabase)

### Clients: three files, three helpers
| Helper | File | Where | For |
|---|---|---|---|
| `createServerSupabase()` | `supabase-server.ts` | Server Components, actions, route handlers | The session (`getClaims()`), user-scoped queries under RLS. **Default.** |
| `createServiceSupabase()` | `supabase-server.ts` | Actions and route handlers, **after authorization**, and webhooks | Admin and cross-user work, tables without policies |
| `createBrowserSupabase()` | `supabase-client.ts` | Client components | Auth UI, realtime, direct Storage uploads |
| `updateSession()` | `supabase-proxy.ts` | `proxy.ts` only | Cookie refresh |

No other Supabase clients. ESLint blocks importing `@supabase/ssr` or `createClient` outside `lib/supabase/`. No generic `getRow(table)` helpers: query typed tables inside the domain action.

Keys: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public) and `SUPABASE_SECRET_KEY` (server only).

### Types
- `types/supabase-types.ts` is generated: `npx supabase gen types typescript --project-id <id> > types/supabase-types.ts`. Regenerate after every migration.
- Pass `<Database>` to every client. Use `Tables<"x">`, `TablesInsert<"x">`, `TablesUpdate<"x">`, `Enums<"x">`.
- For shapes the types don't describe (joins, partial selects), define a type next to the action (e.g. `Note` in `app/actions/notes.ts`).

### Schema and security
- Every schema change is a timestamped SQL file in `supabase/migrations/`.
- **RLS on every table.** A table with RLS and no policies is reachable only by the service client (`payments`, `heatmap_events`, `activity_log`). `site_config` is readable by anyone only for rows marked `is_public`.
- `team_members` rows are created by the `on_auth_user_created` trigger (default role `member`). Members can read their own row but **not update it**: access fields (`roles`, `is_admin`, `is_active`) change only through team actions (§11).
- Every table: `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz`. Soft delete with `deleted_at` where history matters.
- Money: `numeric` or integer cents. Times: `timestamptz` in UTC.
- Atomic multi-table operations: a Postgres function (RPC).

---

## 10. Auth

**`proxy.ts` refreshes the session → server layouts and pages guard → actions authorize themselves → the client uses auth only for UI.**

- `lib/auth.ts`:
  - `getCurrentUserId()` reads the verified JWT.
  - `getCaller()` returns the signed-in, **active** team member with roles resolved into permissions (cached per request).
  - `requireCaller(lang)` / `requirePermission(lang, permission)` redirect (pages and layouts).
  - `callerCan(caller, permission)` / `callerCanAny()` check, and `deny(caller, attempted)` refuses, in actions (§11).
- The dashboard layout requires a member with `dashboard.view` (failing that it sends them home, not back into the dashboard). Sections needing more call `requirePermission` in their own page.
- **Never `getSession()` on the server.** ESLint bans it.
- No client-side route guards.
- Sign-in, sign-up, OAuth and password reset run in the browser client. **Every email/OAuth link returns through `app/[lang]/auth/callback/route.ts`** (PKCE code exchange, `next` limited to same-site paths). The reset link lands on `/auth/new-password`, which requires a session and calls `updatePassword()`.
- The client knows who's signed in through `store/auth-store.ts`, kept in sync by `providers/auth-listener.tsx`, which also refreshes server components and the cached permissions on sign-in and sign-out.
- If the dashboard is staff-only, turn off public sign-up in Supabase and add people with `inviteMember()`.

---

## 11. Roles and permissions

**`team_members.roles[]` → `public.roles` rows → union of their `permissions[]` = what a member can do.** Same model as the AOAP admin panel, with a typed `roles` table instead of `site_config`.

### Tables
- `roles`: `name` (unique, lowercase), `description`, `permissions text[]`, `is_system`. Seeded with `admin` (`isSuperAdmin`) and `member` (dashboard + notes). System roles can be edited but not deleted. Signed-in users can read roles; writes go through actions.
- `team_members`: one row per user with `roles text[]`, `is_active` and `is_admin` (a hard override that passes every check).
- `activity_log`: who did what, including **refused attempts**.

### Permissions
- The catalog is `PERMISSION_GROUPS` in `lib/permissions.ts`. A key is `group.action` (`notes.create`, `users.edit`) and is typed as `Permission`, so a misspelled key doesn't compile.
- `isSuperAdmin` grants everything. Only admins can put it on a role, edit or delete a role that has it, or give someone a role that has it.
- **Adding a permission:** add the action to `PERMISSION_GROUPS`, add its label under `permissions.<group>.<action>` in en/es/it, then check it on the server. The Roles screen shows it automatically.

### Checking access
| Where | How |
|---|---|
| Page / layout | `await requirePermission(lang, "roles.view")` |
| Action | `if (!callerCan(caller, "roles.edit")) return deny(caller, "edit a role");` |
| Client (hide UI only) | `usePermissions().can("users.edit")`, `<Can permission="users.edit">…</Can>`, `useGuard(errors.forbidden)` |

- **Use `deny()` whenever a signed-in caller is refused in an action.** It writes the attempt to `activity_log` and returns `fail("forbidden")`.
- Client checks come from `getMyAccess()` through `hooks/use-permissions.ts` (TanStack, key `my_access`). Role and team mutations invalidate it. They hide buttons; they never protect anything.

### Actions
- `app/actions/roles.ts`: `getRoles` (roles.view, with member counts), `createRole`, `updateRolePermissions`, `deleteRole` (roles.edit; a role still assigned to members can't be deleted: `role_in_use`).
- `app/actions/team.ts`: `getTeamMembers` (users.view), `inviteMember` (users.invite), `updateMemberRoles` and `generateMagicLink` (users.edit), `setMemberActive` (users.deactivate). Nobody changes their own access (`cannot_change_self`) unless they're an admin.
- `app/actions/activity.ts`: `getActivityLog` (audit.view).
- Every change is logged with `logActivity()` from `lib/activity-log.ts`. It lives in `lib/`, not `app/actions/`, so the browser can't write log rows.

### Screens
`/dashboard/roles` (permission matrix per role), `/dashboard/users` (members, role picker, active switch, add member), `/dashboard/activity` (log). Sidebar entries are hidden by permission, and each page checks again on the server.
---

## 12. Site settings

**Anything an admin should be able to change without a deploy is a site setting**: site name, currency, default language, timezone, contact details, maintenance mode, and later fees, tax rates, opening hours or legal text. Same model as the AOAP admin panel (`site_config`), typed end to end.

### Where values live
| Kind of value | Where |
|---|---|
| Changed by an admin at runtime (business config) | **Site settings** (`site_config` table) |
| Fixed per deploy (site URL, feature flags for the build) | env + `lib/site-config.ts` |
| Secrets (API keys, tokens) | env only, server-only |
| User-facing UI text | dictionaries |

### The table
`site_config`: `key` (UPPER_SNAKE, primary key), `category`, `value jsonb`, `description`, `is_public`, `updated_at`, `updated_by`.
- RLS: anyone (including the public website and the proxy) can read rows with `is_public = true`. Everything else is server-only.
- All writes go through `updateSetting()`.
- The migration seeds `SITE_NAME`, `MAINTENANCE_MODE`, `CURRENCY`, `DEFAULT_LOCALE`, `TIMEZONE`, `SITE_CONTACT`.

### The contract: `lib/site-settings.ts`
`SITE_SETTINGS` lists every key with its `category`, Zod `schema`, `default_value`, `is_public` and `input` (how the Settings screen renders it: `text`, `number`, `boolean`, `currency`, `locale`, `timezone`, `object`, `json`).
- Keys are typed (`SettingKey`) and values are typed per key (`SettingValue<"CURRENCY">`), so a misspelled key doesn't compile.
- A missing or invalid stored value **falls back to the default**. A bad row never breaks a page, and a fresh project without the table still runs.
- **Adding a setting:**
  1. Add an entry to `SITE_SETTINGS`.
  2. Add its label and description under `settings.items.<lowercase_key>` in en/es/it (plus `fields` for objects).
  3. Read it.

  No migration is needed. The Settings screen shows it automatically.

### Reading settings
| Where | How |
|---|---|
| Server Components, actions, metadata | `await getSiteSetting("CURRENCY")` / `getSiteSettings()` from `lib/site-settings-server.ts` (one query per request, cached) |
| Client components | `useSiteSettings().CURRENCY` (**public keys only**, defaults while loading) |
| Proxy | `lib/site-settings-proxy.ts`: REST read of a public key with the publishable key, cached in memory for 60 s, falls back on any error (used for `DEFAULT_LOCALE`) |

Never read `site_config` with ad-hoc queries in features. Always go through these helpers, so values are validated and defaulted.

### Changing settings
- `getAllSettings()` needs `settings.view` and returns every key, its value, and whether it's still the default.
- `updateSetting({ key, value })` needs `settings.edit`. It validates against the key's schema, upserts `category`, `description` and `is_public` from the contract, and writes the before and after values to `activity_log`.
- `/dashboard/settings` groups settings by category, with one save per setting. The sidebar entry needs `settings.view`.

### Already wired
- `SITE_NAME`: page titles, OpenGraph site name, dashboard sidebar, concierge.
- `CURRENCY`: base currency for price display (`useCurrency`, `getDisplayRate`). A visitor's own choice still wins.
- `DEFAULT_LOCALE`: the proxy's fallback language.
- `MAINTENANCE_MODE`: notice bar at the top of every page.
- `SITE_CONTACT`: home page footer.

Charged amounts still come from Stripe prices (§20). `CURRENCY` is for display.

---

## 13. i18n (language)

- **`en`, `es` and `it` always ship.** Add more in `i18nConfig.ts` (`LOCALES`), `lib/i18n.ts` (`LOADERS`), `lib/locale/languages.ts` and `dictionaries/`.
- **Single-language app:** set `LOCALES = ["en"]` and `noPrefix: true`. URLs lose the prefix, routes stay under `app/[lang]`, and nothing else changes.
- No hard-coded user-facing text: toasts, validation messages, aria-labels and metadata all come from the dictionary.
- `en.json` defines the shape. `Dictionary = typeof en`, so a missing or misspelled key is a compile error. Every locale has the same keys: when you add a key, add it to all three. If a translation isn't available, use the English text and flag it.
- Keys are `snake_case`, nested by page or feature. Shared words go under `common`, action error codes under `errors`, form messages under `validation`.
- Pass only the slice a component needs, typed as `Dictionary["auth"]["login"]`.
- Interpolation uses `{name}` placeholders replaced in the component (`dictionary.checkout.pay_now.replace("{amount}", …)`).
- Format dates, numbers, currency and relative time with `lib/utils/format.ts` (Intl) and the current `lang`.
- Internal links include the locale: `` `/${lang}/dashboard` ``. Switch locale with `switchLocalePath()`.

---

## 14. Client state (Zustand)

Pattern: `store/checkout-store.ts`.

- One store per concern. Read with selectors (`useCartStore((state) => state.step)`).
- Global modals/drawers are driven by a store.
- `persist` only for things that should survive refresh (with an expiry when it's a draft). Never secrets.
- No server data in stores.

---

## 15. UI and styling

- **shadcn first.** `npx shadcn@latest add <name>`. Customize with variants, not forks.
- Tailwind only, merged with `cn()`. Inline `style` only for computed values.
- **Theme tokens only** (`bg-background`, `text-muted-foreground`, `border-input`, `bg-primary`, `text-destructive`). No hex values or palette colors. Light and dark must both work.
- **Mobile-first**. Test at 375px.
- Icons from `lucide-react`. Toasts from `sonner`. Skeletons for loading. Disable buttons while pending and show a spinner inside.
- `next/image` for images (allow remote hosts in `next.config.ts`), `next/font` for fonts, `Link` for internal navigation.
- Accessibility: semantic elements, a label for every input, `aria-invalid` + `aria-describedby` on errors, `alt` on meaningful images.

---

## 16. Forms and validation

Pattern: `app/[lang]/dashboard/notes/components/note-form.tsx`.

- One Zod schema per form/action in `lib/schemas/`. Infer types from it.
- Validate on the client for feedback, and **always again on the server**.
- Submit through a TanStack mutation hook. Field errors inline, overall result as a toast.
- Use Zod's current API (`z.email()`, `z.url()`, `z.uuid()`, `z.iso.datetime()`).

---

## 17. Errors and logging

- Expected failures return `fail(code)`. Unexpected ones call `reportError(module, context, error)`, which logs and posts to Slack when `SLACK_ERROR_WEBHOOK` is set.
- `error.tsx` per section, plus `app/global-error.tsx`.
- No `console.log` (ESLint error). `console.error`/`console.warn` only inside logging helpers.
- No empty `catch {}` without a one-line reason.

---

## 18. TypeScript and general code

- `strict`, **no `any`** (ESLint error). Use `unknown` and narrow. No `@ts-ignore`.
- `type` for shapes, `interface` only to extend.
- `@/` imports. Relative only for a route's own `./components/…`.
- `async`/`await`. Early returns. Small functions.
- Comments explain **why**. No commented-out code.
- Code and comments in English.
- Delete dead code as part of the change that makes it dead.

---

## 19. Environment variables and secrets

- Every variable is listed in `.env.example`. `.env*` is git-ignored except `.env.example`.
- `NEXT_PUBLIC_` only for public values (Supabase URL and publishable key, Stripe publishable key, tracking ids).
- Secrets have no prefix and are read only in `server-only` modules.
- Deploy-level constants (`SITE_URL`) live in `lib/site-config.ts`, fed by env. Business values an admin changes (site name, currency, language, contact) are site settings (§12), not env.
- Never commit credentials. **If one is committed, rotate it.** Deleting the file doesn't remove it from git history.

---

## 20. Payments (Stripe)

- The charged amount comes from a Stripe price (`STRIPE_PRICE_ID`, with `currency_options` for multi-currency), **never from the browser**. `lib/fx.ts` rates are for display only.
- `createCheckoutSession()` attaches customer details and ad attribution as metadata.
- The **webhook** (`app/api/stripe/webhook/route.ts`) is the source of truth: it verifies the signature, upserts `payments` idempotently, and sends the server-side Meta Purchase.
- The success page only displays status and fires the browser-side conversion once.

---

## 21. Tooling

| Script | What it does |
|---|---|
| `npm run lint` | ESLint (Next config + the rules below) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier |
| `npm run build` | Production build |

`eslint.config.mjs` enforces this document:
- Naming (`@typescript-eslint/naming-convention`).
- Supabase client imports allowed only in `lib/supabase/`.
- `getSession()` is banned.
- `"use client"` is banned in `page.tsx`/`layout.tsx`.
- `any` and `console.log` are errors.
- React hooks and purity rules come from the Next config.

`components/ui/` and `types/supabase-types.ts` are excluded from the naming rule.

In Claude Code, `.claude/settings.json` runs `.claude/hooks/lint-file.mjs` after every edit and reports lint errors back immediately.

Don't disable a rule inline without a reason next to it. Tests (Vitest) cover pure business logic: pricing, availability, permissions, date math.

---

## Changelog

- **2.3 · 2026-10-24**
  - Added §12 Site settings: typed `site_config` key/value store with defaults, public/private keys, server, client and proxy readers, admin Settings screen, `settings.view` / `settings.edit`, and hard rule 17.
  - `SITE_NAME` and the base currency moved from env/constants to settings.
- **2.2 · 2026-10-24**
  - The template is now a component library, not a starter.
  - Added "Starting a new app": create-next-app, copy the foundation, add pieces per need, feed reusable components back.
- **2.1 · 2026-10-24**
  - Added §11 Roles and permissions: `roles` table, `team_members` (replaces `profiles`), resolved permissions, `deny()` + `activity_log`, Roles/Team/Activity screens, `usePermissions` / `<Can>` / `useGuard`.
  - Permission keys are now `group.action` and typed.
- **2.0 · 2026-10-23**
  - Template rebuilt to follow this document.
  - Added: proxy + tracking + Meta section, `lib/schemas/`, action error codes, three Supabase helpers, required locales en/es/it, ESLint enforcement, Claude Code hook, reference feature `notes`, hard rules 15–16.
  - Removed: Primer.
- **1.0** · Initial draft.
