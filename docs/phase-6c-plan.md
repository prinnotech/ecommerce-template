# Phase 6c plan: more pages, menus, footer and images

**Status: built (2026-11-05).** Clicked through on PocketBase: product/about/contact pages from sections, a custom page (create → edit sections with FAQ → publish → menu link → sitemap), image upload into the hero, publish. SQL migration `0007_pages_media` checked on SQLite; the SQL backends weren't clicked through in the browser.

Changes from the plan: custom pages and menus save directly and are live at once (no draft), like Shopify pages and menus; uploads accept jpg/png/webp/avif (no gif, to match the existing storage code); the video section takes a link (YouTube, Vimeo or a file URL), not an upload.

Goal: after 6b only the home page is built from sections. 6c makes the rest of the store editable the way Shopify does.

## What the owner gets

1. **Page templates in the editor.** A page picker at the top of the editor: **Home**, **Product page**, **About**, **Contact**, **Custom pages**.
   - **Product page:** the product block (gallery, price, sizes, add to cart) stays fixed. Sections can be added above and below it, for example size guide text, an image with text, "you may also like" or a newsletter.
   - **About / Contact:** built from sections. The contact form becomes a section you can move.
   - **Shop, cart, checkout and account** keep their layout. They're functional pages and Shopify keeps them fixed too. They still follow the theme's look.
2. **Custom pages** (Online store → Pages): create a page with a title and an address (`/pages/size-guide`), build it from the same sections, publish or hide it. Each page has SEO title and description fields. Pages are content, not part of a theme, so switching themes never loses them.
3. **Navigation** (a tab in the editor):
   - **Header menu:** pick the items and their order (categories, custom pages, any link, nested one level). Today it's automatic from the top categories, and that stays the default.
   - **Footer:** columns with a title and links, plus a text block (about / social) and toggles for contact details and payment methods.
4. **New sections**, usable on any page:
   - FAQ (questions and answers)
   - Image gallery / lookbook (2–4 images, optional links)
   - Contact form
   - Video (YouTube/Vimeo link, or a file)
   - Spacer / divider
5. **Image uploads:** an "Upload" button next to every image field (hero, image with text, gallery). It also offers a picker of images already uploaded, so the same photo can be reused. Links still work.

## How it's built

- **Theme data v2:** `theme.pages` = `{ home, product, about, contact }`, each a list of sections. The product page has a fixed `product` section that can't be removed, and custom pages use a `page` template. Themes saved by 6b are upgraded when they're read (`parseThemeData`: old `sections` → `pages.home`), so no data migration is needed.
- **New `pages` table** on PocketBase and the SQL backends: `title` (per language), `slug`, `sections`, `seo`, `is_published`. The live store reads only published pages, and the sitemap lists them.
- **Navigation:** a new site setting `NAVIGATION` (header menu + footer), so it doesn't depend on the theme. The editor edits it, and the preview shows the draft before saving. It's saved as a draft and goes live with Publish.
- **Uploads:** a new `media` table with a file field (PocketBase), Supabase Storage, or the local `/media` folder (SQLite). These reuse the existing storage code for product images. Limits: 10 MB, images only (jpg, png, webp, avif, gif).
- **Permissions:** `pages.view` / `pages.edit`. Uploading media uses `themes.edit` or `pages.edit`.
- **Preview:** the editor's iframe follows the selected page (home, a sample product, about, contact, a custom page).

## Steps

1. Theme data v2 with upgrade of old themes, and the page picker in the editor.
2. Product, About and Contact pages rendered from the theme (+ contact form section).
3. New sections: FAQ, gallery, video, spacer.
4. Navigation setting + editor tab + header/footer rendering.
5. Custom pages: table (PocketBase + SQL), actions, Pages screen in the admin, store route `/[lang]/pages/[slug]`, sitemap.
6. Media uploads on all three backends + image picker in the editor.
7. Text in en/es/it, lint, typecheck, build, click-through on PocketBase and SQLite.

## Needs your OK

- **Two new tables:** `pages` and `media`, each with a migration for PocketBase and for the SQL backends.
- **New setting:** `NAVIGATION`.
- **New permissions:** `pages.view` / `pages.edit`. The demo role gets `pages.view`.
- **Settings move into the theme:** the About page text (`ABOUT_CONTENT`) becomes a section in the theme's About page. Existing text is carried over on the first read.
- **No new dependencies.**
