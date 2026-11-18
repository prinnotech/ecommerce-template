# Phase 10 plan: Shopify-level polish

**Status: approved (17 Nov 2026).**

**Decisions:**
- **AI:** the Vercel AI SDK with Claude, ChatGPT and Gemini. The owner picks a provider and types its key in Settings → AI.
- **Translations:** UI text **and** store content.
- **Extras:** every §6 feature.
- **Order:**
  1. §1.
  2. §3, the theme builder.
  3. §2.
  4. §4.
  5. §5.
  6. §6.

The request: fix the admin UIs, make the theme builder work and be much better, make languages editable (JSON translations, AI translation from Settings), add Twilio SMS/WhatsApp notifications, and close more of the gap with Shopify. Reference: the Shopify admin and theme editor.

Already built and easy to miss: promo codes (Discounts), analytics (Analytics), gift cards, collections, reviews, abandoned checkouts. They're in the sidebar under Discounts / Analytics / Products. §6 lists what Shopify has that we still don't.

## 1. Live preview and secrets without extra env variables (small, first)

**Problem:** the theme editor shows "Live preview is off", and Stripe/SMTP secrets can't be saved, because `THEME_PREVIEW_SECRET` and `SETTINGS_ENCRYPTION_KEY` must be set by hand on both apps. A template buyer will hit the same wall.

**Fix:**
- When either variable is missing, derive it from the server secret each backend already has: `POCKETBASE_SUPERUSER_PASSWORD`, `SUPABASE_SECRET_KEY`, or a key file next to the SQLite database.
- Use HKDF with a different label per purpose.
- Both apps get the same value with nothing to configure. An env variable still wins.
- Update `docs/deploy.md`: the two variables become optional.

## 2. Admin UI pass

**Done 17 Nov 2026:** round 3 in `docs/ui-audit.md` (U1–U5).

**Audit:** a fresh click-through of every admin screen on a local build, against Shopify, at 1366 px and 375 px. The findings get added to `docs/ui-audit.md` as round 3.

Already seen in the screenshots:
- **Products list:**
  - "1 variants": the plural is missing; use `formatPlural`.
  - The inventory cell wraps onto three lines; Shopify uses one line, "10 in stock for 1 variant".
  - The price column is cut off on the right.
  - Thumbnails are empty.
- **Demo data has no product images.** `seed-catalog.mjs` creates products without photos, so the demo looks unfinished. Fix: ship a small set of freely licensed product photos in `scripts/demo-assets/` and attach them in the seed.

## 3. Theme builder v2 (Shopify-style)

**Fix what's there:**
- Live preview works out of the box (§1).
- Click a section in the preview to select it.
- Hover outlines on sections in the preview.

**Structure:**
- Like Shopify: **Header** group (announcement bar, header), **Template** (the page's sections), **Footer** group.
- Each part has "Add section".

**Blocks:**
- Sections hold blocks: slides, columns, FAQ items, menu links, footer columns.
- Blocks can be added, reordered, hidden and duplicated.

**Editing:**
- Drag and drop reordering.
- Show/hide eye icon.
- Duplicate and delete.
- Undo/redo.
- An "Add section" picker with a thumbnail and description for each section.

**New sections:**
- Announcement bar: rotating messages and arrows.
- Header: logo, menu, layout options.
- Slideshow.
- Marquee.
- Featured collection.
- Collection list.
- Media with text: image or video, left or right.
- Multicolumn.
- Image banner.
- Testimonials.
- Footer: columns, newsletter, socials, payment icons.

**More templates and settings:**
- Templates to edit: home, product, collection, shop, page, cart, contact, about.
- Color schemes in theme settings, picked per section.
- Typography presets.
- Logo and favicon.

**Data:**
- Same theme storage as now: draft, publish, versions.
- Old themes are upgraded when read, like `parseThemeData` does today.

### 3.1 Design

**Theme data:**
```
settings        colors, fonts, radius, buttons, product_card, uppercase headings (as now)
header_group    announcement: { messages[] (text, link), autoplay_seconds, color_scheme, is_hidden }
                header:       { layout, logo_url, logo_width, is_sticky, show_utility_bar, color_scheme }
footer_group    footer:       { show_newsletter, newsletter text, show_socials, show_payment_icons,
                                copyright, color_scheme }
pages           home, product, collection, about, contact
```

**Color schemes:**
- Every section gets `color_scheme`: `default`, `muted`, `inverse` or `accent`.
- The schemes are derived from the theme's palette, so they work in light and dark mode without extra settings.
- The CSS comes from `themes/css.ts`.

**Header and footer:**
- These settings move out of `settings.header`.
- The header and footer links still come from the `NAVIGATION` setting, edited in the Navigation tab.

**Collection template:**
- A new `collection` page template, used by Shop, collections and categories.
- It has a fixed `product_list` section (filters, sorting, grid), with sections allowed above and below it.

**New section types:**

| Section | What it shows |
|---|---|
| `slideshow` | Slides, each with an image, heading, text and button; optional autoplay |
| `marquee` | Scrolling text items |
| `collection_list` | Chosen collections as tiles |
| `multicolumn` | Columns, each with an image, heading, text and link |
| `image_banner` | A full-width image with text, a button, a height and an overlay |
| `testimonials` | Quotes, each with an author and a rating |

Sections with a repeated part store it as `items[]` with ids, and are edited with the existing item list.

**Upgrading stored themes:** `parseThemeData` moves old themes forward:
- `settings.header.layout`, `show_utility_bar` and `announcement` go into `header_group`.
- The `collection` page gets the template's default.
- Every section without a scheme gets `color_scheme: "default"`.

**Editor:**
- **Top bar:** page picker, with every template plus custom pages; device toggle; language; undo/redo; versions; publish.
- **Sidebar:** Header (Announcement bar, Header) · Template (the page's sections, Add section) · Footer. Clicking an entry opens its settings, with a Back button.
- **Add section picker:** search, then an icon, name and one-line description for each type.
- **Section menu:** show/hide, duplicate, move, remove.
- **Preview:**
  - Sections are wrapped in `data-theme-section`.
  - Hovering outlines a section and shows its name.
  - Clicking a section selects it in the sidebar.
  - Selecting a section in the sidebar scrolls the preview to it.
  - This works through `postMessage` between the admin and store origins, both checked.
- **Undo/redo:**
  - Theme edits keep a history of up to 50 steps.
  - Shortcuts: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
  - Undo saves like any other edit.

### 3.2 Progress (17 Nov 2026)

Steps 1–6 are built, and checked in the browser on a local test copy.

Not done yet:
- A dedicated typography preset picker. The font pairs are still chosen in Theme settings.
- Editable cart, contact and about templates. About and Contact already have sections; the cart is still fixed.
- Blocks inside the header. The menu still comes from the Navigation tab.

### 3.2 Steps

1. Editor interaction:
   - Preview select, hover and scroll.
   - Undo/redo.
   - The add-section picker.
   - Duplicate.
   - The page picker in the top bar.
2. The schema:
   - Header and footer groups.
   - Color schemes.
   - Announcement messages.
   - Header logo and sticky option.
   - Footer settings.
   - The upgrade of stored themes.
   - Store header and footer rendering.
3. The new section types.
4. The collection template and `product_list`.
5. The four templates updated to use the new sections.
6. `docs/themes.md` and the dictionaries (en/es/it).

Each step ends with lint, typecheck and build passing and a check in the browser.

## 4. Languages and translations

**Today:** `en`, `es`, `it` are fixed in code (`LOCALES`, used in about 30 files). The UI text lives in JSON dictionaries in the repo. Product content has one field per language.

**New: Settings → Languages, like Shopify "Languages" + "Translate & Adapt":**
- **Languages:**
  - Add any language from a list.
  - Publish or unpublish it.
  - Choose the default.
- **Routing:** the store's language prefix and the language switcher follow the published languages at runtime. No rebuild is needed.
- **Translations editor:** one screen per language, split into **Store text**, **Emails/SMS**, **Theme content** and **Products/collections/pages**.
  - Search.
  - Show only missing items.
  - Edit inline.
  - **Import/export JSON** in the same shape as the repo dictionaries.
- **Storage:**
  - The repo JSON files stay as the base for en/es/it.
  - Edits and new languages are stored per language in a `translations` table.
  - Anything missing falls back to the default language, then English.
- **Translate with AI:**
  - Translate missing items, or everything, for one language, with progress.
  - Text is sent in batches with the key names as context and `{placeholders}` protected.
  - Results are drafts until saved.
  - The AI key is typed in Settings → AI and stored encrypted, like the Stripe key.
- **Content fields:**
  - Product/collection/page fields stop being fixed to three languages and become `{ [language]: text }`.
  - Existing data keeps working.
  - Needs a migration on all three backends.

**Built 17 Nov 2026** (guide: `docs/languages.md`). Not done yet:
- The theme's texts and email templates have no AI button; theme texts are translated in the theme editor's language tabs.
- The CSV product import still reads only `title_en/es/it` columns.

### 4.1 Design (17 Nov 2026)

**Language codes:**
- `Locale` becomes any language code (`fr`, `de`, `pt-BR`), checked with a pattern.
- `LOCALES` stays the three languages that ship JSON dictionaries: en, es, it.

**Store languages:**
- New public setting `LANGUAGES`: `[{ code, is_published }]`.
- The store proxy routes the published ones, cached for 60 s like `DEFAULT_LOCALE`.
- Unpublished languages can be previewed but aren't linked from the language switcher.

**UI text:**
- New private setting `UI_TRANSLATIONS`: `{ [code]: { "dotted.key": text } }`.
- `getDictionary(lang)` loads the shipped JSON for the language, or English for any other language, then applies these overrides.
- Settings only, so there's no database migration on any backend.

**Content:**
- `localized_text_schema` accepts any language code.
- Products, categories, collections, pages and themes simply get extra keys, so there's no migration here either.
- Editors show a tab for every language in `LANGUAGES`.

**AI:**
- New setting `AI`: `{ provider: anthropic | openai | google, model }`.
- The keys are in `SECRET_KEYS`, stored encrypted: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`.
- `lib/ai/translate.ts` uses the Vercel AI SDK (`ai` + `@ai-sdk/anthropic` / `openai` / `google`) with `generateObject`.
- Text is sent in batches of about 80 strings, with `{placeholders}` checked after translation.
- Results come back as drafts that the owner saves.

**Screens:**
- Settings → Languages: add a language, publish/unpublish it, set the default.
- Per-language translation editor:
  - Tabs: Store text, Products, Collections & categories, Pages, Theme.
  - Search, and a "missing only" filter.
  - Import/export JSON.
  - Translate missing items with AI.
- Settings → AI: provider, model, API key, "Test".

## 5. SMS and WhatsApp (Twilio)

**Settings → SMS & WhatsApp:**
- Twilio Account SID.
- Auth token, encrypted.
- SMS sender: a number or a Messaging Service.
- WhatsApp sender.
- "Send test".

**Events:**
- Each event can be switched on separately for SMS and for WhatsApp.
- Customer events:
  - Order confirmed.
  - Shipped, with tracking.
  - Delivered.
  - Cancelled or refunded.
  - Abandoned checkout.
- Staff alerts: new order, low stock.

**Templates:**
- SMS: free text per language with the same `{placeholders}` as the emails.
- WhatsApp: business-initiated messages must use templates approved by Meta. Each event maps to a Twilio Content template SID, plus which placeholders fill its variables.

**Consent:** the checkout gets an optional "Send me order updates by SMS/WhatsApp" checkbox. Messages go only to customers who ticked it.

**Sending and logging:**
- Sending goes through Twilio's REST API with `fetch`, so no new dependency.
- Messages are sent after the response, like the order emails.
- Every message is logged in `message_log`, which is also shown on the order timeline.

**Permissions:** `notifications.view` / `notifications.edit`. The demo role can view only.

## 6. More Shopify features: pick which ones (§7)

| Feature | What it is |
|---|---|
| **Automatic discounts + Buy X get Y** | Discounts without a code, quantity/bundle deals, several discounts on one order |
| **Blog** | Articles with images, tags and SEO; the store gets `/blog` |
| **Files** (Content → Files) | A media library for all uploads, reused across products, themes and pages |
| **Customer segments + marketing** | Saved customer filters (spent > X, last order < 30 days), CSV export, email campaigns to a segment |
| **Markets** | Per-country currency, prices and language |
| **Metafields** | Custom fields on products, collections and customers, shown in themes |
| **Analytics reports** | More reports: sales by product, channel, discount, returning customers, conversion funnel |
| **Shipping labels / fulfillment** | Partial fulfillment, multiple packages, carrier tracking links |

## 7. Decisions needed

1. **AI provider** for translations: Claude (Anthropic) is my suggestion. Other options: OpenAI, or let the owner choose.
2. **What gets translated:** UI text only, or UI text **and** store content (products, collections, pages, theme text)? I suggest both.
3. **Which §6 features**, if any, go into this phase.
4. **Order of work.** I suggest:
   1. §1 (secrets).
   2. §2 (UI pass + demo images).
   3. §3 (theme builder).
   4. §4 (languages).
   5. §5 (Twilio).
   6. The chosen §6 features.

Each step ends with lint, typecheck and build passing and a browser check, and the demo is redeployed after each one.

**Size:** §3 and §4 are each about as big as phase 6b. §4 also changes the schema on all three backends.
