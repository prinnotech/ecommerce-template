# Phase 6b plan: themes and theme editor

**Status: built (2026-11-05).** Clicked through on PocketBase: gallery, add template, editor (settings, sections, hide/add), autosave + live preview, publish (store updates at once), restore a version, switching the live theme. SQL migration `0006_themes` checked on SQLite; the SQL backends weren't clicked through in the browser. Section images are URLs for now (no upload).

## Why

Today the home page is fixed code. An admin can only change the hero title, subtitle and image, plus the announcement bar. For a template sold to stores, "pick a look and make it my brand without code" is the main selling point after the checkout. Shopify's model is the one store owners already know:

- a **theme library**: pick a theme, customize it, publish it
- the editor (**Customize**): sections, settings, live preview

## 1. Theme templates (Admin → Online store → Themes)

- **Theme gallery:** each template has a name, a short description, a preview image and a "Try it" button.
- **Starting set (4 templates, original designs):**

| Template | Look | Header | Product cards | Fonts |
|---|---|---|---|---|
| **Atelier** (default, today's store) | editorial, soft neutrals | logo left, menu centre | plain image, name, price | serif headings, sans body |
| **Minimal** | lots of white, small type, monochrome | logo centre, menu below | no borders, second image on hover | one clean sans |
| **Bold** | big type, strong accent colour, streetwear | logo left, large menu | border, badge-first | condensed display + sans |
| **Classic** | warm, boutique/luxury | logo centre, utility bar on top | framed, centred text | high-contrast serif |

- **A template is more than colours.** It sets:
  - the header and footer layout
  - the product-card style
  - the hero style
  - which sections the home page starts with
  - default colours and fonts
  - the radius and button style
- **Theme library:**
  - Add a template from the gallery to your library.
  - One theme is **Live**; the others are drafts you can Customize, preview, **Publish**, **Duplicate**, **Rename** or **Delete**.
  - Each theme keeps its own settings, so switching back and forth loses nothing.
- **Templates are code:** each lives in `packages/core/themes/<name>/` with its defaults and variant choices, behind one registry. A developer (or a buyer of the template) adds a new template by adding a folder, and it appears in the gallery. Owners never edit code.

## 2. Theme editor (Customize)

- **Left panel:**
  - the theme's home page sections in order: add, remove, drag to reorder, hide, edit
  - a **Theme settings** tab
  - text in en/es/it
- **Right side:** a live preview of the real store in an iframe, desktop/mobile toggle, refreshing as you type.
- **Sections (shared by all templates; each template styles them in its own way):**
  - announcement bar
  - hero (image, heading, subtitle, up to two buttons, alignment)
  - trust badges
  - category tiles
  - product grid (featured / newest / one category, how many)
  - image with text
  - rich text
  - newsletter sign-up (saved to `messages`; no email provider yet)
- **Theme settings:**
  - colours (background, text, accent/buttons, muted; checked for readable contrast)
  - heading and body font from a curated `next/font` list
  - corner radius and button style
  - header and product-card variant (the template's choice is the default)
  - logo and favicon
- **Saving and publishing:**
  - Edits autosave to that theme's draft.
  - **Publish** on the Live theme updates the store; publishing another theme makes it Live.
  - Each theme keeps its last 10 published versions, with one-click **Restore**.
- **Permissions:** `theme.view` / `theme.edit`. The demo account opens everything read-only.

## Not in this phase (proposed)

- **Custom CSS / custom HTML in `<head>`:** it would let a staff account run any script on the checkout page. I'd add it later, admin-only, if wanted.
- **Menu editing and section layouts for other pages** (shop, product page): only the home page gets sections. Other pages follow the theme's colours, fonts, radius, header and card variants.
- **The MCP server:** see the end.

## How it's built

- **Storage: a new `themes` table on all three backends** (PocketBase migration + `backend-sql` migration `0006_themes`):
  - columns: `id`, `name`, `template`, `draft` (json), `published` (json), `history` (json, last 10), `is_live`, `created_at`, `updated_at`
  - only one row can be live, set in a transaction / batch like the primary domain
  - locked to the server: the store reads only the live theme's `published` through the backend
  - a settings key would be enough for one theme, but not for a library with drafts and history per theme
- **Validation:** one Zod schema (`lib/schemas/theme.ts`) for sections and settings. A bad or missing value falls back to the template's defaults. With no theme row at all (fresh install), the store renders Atelier's defaults, so it looks exactly like today.
- **Store rendering:**
  - The home page renders the live theme's sections through `apps/store/components/sections/*`.
  - The header, footer and product card pick their variant from the theme.
  - Colours, fonts and radius become CSS variables that override the existing theme tokens, so components keep using `bg-primary` and the like (no raw colours).
- **Preview:**
  - The admin iframe loads the store with `?theme_preview=<token>`: a short-lived HMAC naming the theme, signed with a new server-only secret, `THEME_PREVIEW_SECRET`, set in both apps.
  - With a valid token, the store renders that theme's draft, uncached. Without one, drafts are never readable.
  - The store may be framed by the admin's origin only (`frame-ancestors`).
- **Actions** (`packages/core/actions/themes.ts`), each authorized and logged to the activity log:
  - `getThemes`, `getTemplates`, `addTheme(template)`, `duplicateTheme`, `renameTheme`, `deleteTheme` (not the live one)
  - `saveThemeDraft`, `publishTheme`, `restoreThemeVersion`, `discardDraft`
  - These same actions are what the MCP server will call later.
- **Revalidation:** publishing tells the store to revalidate at once, through a small signed `POST /api/revalidate` on the store.
- **Dictionaries:** admin `themes.*` (en/es/it), and store text for the new sections.

## Steps

1. Theme schema, template registry with **Atelier** as today's store, CSS variables, `themes` table on the three backends. The store looks identical.
2. Section components and header/footer/card variants; home page renders from the live theme.
3. Actions, permissions, revalidate endpoint.
4. Admin: Themes library + gallery.
5. Admin: Customize editor (sections, forms, theme settings, publish/history).
6. Live preview (token, iframe, desktop/mobile).
7. The other three templates: Minimal, Bold, Classic.
8. Lint, typecheck, build, click-through on PocketBase and SQLite.

## Needs your OK

- **New `themes` table:** two migrations, one for PocketBase and one for the SQL backends.
- **New env var `THEME_PREVIEW_SECRET`:** server only, both apps.
- **New store route `/api/revalidate`:** called by the admin app, which is a different app, so an action can't be used.
- **No new dependencies:** drag-and-drop uses native drag events plus up/down buttons, which also keeps it keyboard accessible.
- **Custom CSS/HTML left out**, as explained above.

## Later: MCP server for Claude (last phase, after the public repo)

- An MCP server that lets Claude manage a store with the owner's permission, through the same actions the admin uses:
  - products, orders, customers, messages
  - settings
  - themes (pick a template, edit sections, publish)
- It signs in as a staff member, with a role, so the same permission checks, read-only mode and activity log apply.
- It's planned for the end; nothing in this phase is built for it beyond keeping every theme change an action with a typed Zod schema, which an MCP tool can reuse as its input schema.
