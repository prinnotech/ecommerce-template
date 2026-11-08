# UI audit (phase 0)

Checked on the local copy on 30 Oct 2026: admin and shop at desktop size (1366×850) and on a phone (375×812), dark and light mode. Test data: the seed products, 6 imported Nike products and 3 test orders.

Each item says **where**, **what's wrong**, and **the fix in the rebuild**. Severity: 🔴 broken or misleading · 🟠 clearly wrong or clumsy · 🟡 polish.

## Admin – across all screens

| # | | Problem | Fix in the rebuild |
|---|---|---|---|
| A1 | 🟠 | Every list screen has a different filter style: Orders uses underline tabs, Products segmented buttons, Messages underline tabs again, Settings a scrolling tab strip with tiny ⇕ arrows. | One **index table** pattern with saved-view tabs + filter chips (Shopify style). |
| A2 | 🟠 | The top bar is empty apart from the sidebar button: no page title, no search, no store switcher. On a phone the admin has no title or logo at all. | Top bar with global search, store name, notifications, profile menu. |
| A3 | 🟠 | No bulk actions anywhere (select rows → archive, change status, delete, export). | Row selection + bulk action bar in the index table. |
| A4 | 🟠 | Plural bugs: "1 articoli", "1 varianti", "1 clienti". | Proper plural rules (Intl.PluralRules) in every language. |
| A5 | 🟡 | Numbers in inputs are not localized: the price field shows `90.99` while the rest of the admin shows `90,99 €`. | Money input that formats per language. |
| A6 | 🟡 | Status badges are all the same grey: Unpaid, Paid, Refunded and Pending look alike. | Colored status badges (Shopify: yellow = attention, green = done, grey = closed). |

## Admin – Home

| # | | Problem | Fix |
|---|---|---|---|
| H1 | 🟠 | "Low stock" lists every sold-out size separately: one shoe fills the card with 8 identical rows of "0 left". | Group by product ("3 sizes sold out"), separate "out of stock" from "low stock". |
| H2 | 🟡 | The "Recent orders" card stretches to the height of the right column, leaving a big empty area; the two shortcut cards at the bottom are half-width and look unfinished. | Shopify-style home: KPI row with change vs previous period, chart, then to-do cards ("1 order to fulfill"). |
| H3 | 🟡 | KPIs show no comparison with the previous period. | "+12% vs previous 30 days" under each KPI. |

## Admin – Orders

| # | | Problem | Fix |
|---|---|---|---|
| O1 | 🟠 | On a phone the order list hides payment and fulfillment status, so you can't tell what needs doing. | Mobile list rows show status badges under the customer. |
| O2 | 🟠 | Order page has no **fulfillment** card ("Unfulfilled – Mark as fulfilled" with the items), which is the core of Shopify's order page. Tracking is a long form in the sidebar with two confusing buttons ("Save and mark shipped" / "Save tracking"). | Main column: Unfulfilled/Fulfilled card with items + "Fulfill" dialog (carrier, tracking). |
| O3 | 🟠 | Payment summary is a tiny card at the bottom of the sidebar. | Shopify layout: payment card in the main column under items (subtotal, shipping, taxes, total, paid/balance). |
| O4 | 🟡 | Item images show an empty grey square. | Product thumbnail from the order snapshot. |
| O5 | 🟡 | Internal note has no visible save button or saved state. | Autosave with "Saved" indicator. |

## Admin – Products

| # | | Problem | Fix |
|---|---|---|---|
| P1 | 🔴 | **Product editor opens on the English tab even when the product only has Italian text**: the title and description look empty, and saving could look like data was lost. | Open on the admin's language, and show which languages are filled. |
| P2 | 🔴 | A product with many variants (308 for one imported shoe) is one endless table; color names and SKUs are cut off ("Pure Plat", "NKE-IO48"). | Shopify-style **options** (Color, Size) with variants grouped by color, collapsible, bulk-edit price/stock. |
| P3 | 🟠 | Product list table overflows the page width on a 1366px screen (horizontal scrollbar). | Responsive index table; less important columns collapse. |
| P4 | 🟠 | Thumbnails in the list are tiny (36px) and nearly invisible on white-background product photos. | 40–48px thumbnails with a border. |
| P5 | 🟠 | Images are per product, not per color: choosing a color in the shop doesn't change the photos. | Assign images to a color (option value). |
| P6 | 🟡 | Search placeholder is cut off ("Cerca per titolo, identificativo o"). | Shorter placeholder / wider field. |

## Admin – Categories

| # | | Problem | Fix |
|---|---|---|---|
| C1 | 🟠 | Red "Delete" text link on every row: noisy and easy to misclick. | Delete inside the row's "…" menu or on the edit page, with confirmation. |
| C2 | 🟠 | Flat list with mixed-language handles (`women`, `men`, `scarpe-donna`); no way to build a menu or a hierarchy visually. | Categories as a tree (drag to reorder/nest) + separate **Navigation** settings for the header menu. |

## Admin – Settings

| # | | Problem | Fix |
|---|---|---|---|
| S1 | 🟠 | A separate "Save" button under every single field, plus a "Default" badge on each one. | Shopify settings layout: sections on the left, one sticky "Unsaved changes – Discard / Save" bar. |
| S2 | 🟠 | Logo is a URL text field. | Logo upload (and favicon). |
| S3 | 🟡 | Language labels are lowercase ("inglese", "spagnolo"). | Capitalized names, flags. |

## Shop

| # | | Problem | Fix |
|---|---|---|---|
| X1 | 🔴 | **On phones the header overflows: the cart icon is cut off** at the right edge, and the account icon is hidden. | Phone header: menu · logo · search · cart; language and account inside the menu. |
| X2 | 🟠 | The header menu is just the category list in creation order ("Vedi tutto, Scarpe Bambini, Scarpe, Scarpe Donna, Scarpe Uomo, Donna"); at medium widths items wrap onto two lines. | Menu editor in the admin (Navigation), mega-menu for Men / Women / Kids. |
| X3 | 🟠 | Shop size filter mixes clothing sizes with ~40 shoe sizes in one huge grid. | Filters per category / option, collapsible groups. |
| X4 | 🟠 | Product page: 20 color swatches that look the same (many greys, several pinks), because imported colors only have a "simple" color. | Swatches show a photo of that color (or the color name on hover/label); group identical swatches. |
| X5 | 🟠 | The card shows "−35%, from 90,99 €" but the product page opens on a 139,99 € color with no strike-through price, so the discount seems to disappear. | Product page opens on the cheapest/sale color; show compare-at price per variant. |
| X6 | 🟡 | Home hero is a plain dark block with no image; category tiles have no images. | Hero image/video and category images editable in the admin. |
| X7 | 🟡 | "Added to cart" shows a toast; Shopify-style themes open a **cart drawer**. | Slide-in cart drawer with upsell space and checkout button. |
| X8 | 🟡 | The cart page shows grey placeholders for ~2 seconds before items appear. | Render the cart on the server first. |
| X9 | 🟡 | Checkout: country starts empty ("—") instead of the store's country or the visitor's; product title truncated in the summary; VAT/"taxes included" line missing. | Pre-select country, wrap titles, show taxes line. |

## What worked well

- Checkout layout and flow are close to Shopify's (contact → delivery → shipping → payment, sticky summary).
- Light and dark mode both render correctly.
- Language switcher with flags, translations and the CSV import behave correctly.
- Order list, order timeline and customer pages work; data is correct.

## Not checked yet

- The customer account pages (orders, addresses, profile) as a signed-in customer.
- Tablet size (768px).
- Email templates (password reset, order confirmation).
- Keyboard-only use and screen readers in depth.
- Anything you've seen that isn't on this list: send it and it goes in.

---

# Click-through 2 (3 Nov 2026, after phase 4)

Checked on the local copy (PocketBase backend, demo data), signed in as the store owner: admin at 1366px, ~730px and 375px, shop and checkout at 375px, dark mode only. Nothing was saved. Lint, typecheck and build pass.

**Fixed since round 1:** A1 (mostly), A2, A3, A4, O1, O2, O3, P1, P2 (grouping), P3, P4, P5, C1, S2, X1, X3, X4, X5, X7, X9 (country).

## Still broken or new

| # | | Where | Problem |
|---|---|---|---|
| R1 | 🔴 | Messages, phone and tablet | A message can't be opened: the rows have no link or button below desktop width, and the reading pane only exists on desktop. |
| R2 | 🔴 | Order page, Payment card | The "Paid €…" line uses the badge fill color as text: dark green on a dark card, nearly invisible. |
| R3 | 🟠 | Staff sign-in | Shows the customer text "Sign in to see your orders and saved addresses" (reuses the store's login dictionary). |
| R4 | 🟠 | Fulfill dialog | The cancel button says "Keep order" (text from the cancel-order dialog). |
| R5 | 🟠 | Customers list | Not rebuilt: old segmented All/Account/Guest filter instead of the index table (no selection, sort or saved views); the browser tab has no page title. |
| R6 | 🟠 | Customers list | Staff accounts (Demo, Dev Admin) are listed as customers. |
| R7 | 🟠 | Customer page | The orders table repeats the customer's name on every row instead of date and status. |
| R8 | 🟠 | Product editor, variants | SKUs and color names are cut off ("NKE-IO4862-002…", "Pure Platinum/Bian"); size/SKU/price inputs use a bigger font than every other field; the variants card stays in the left column next to an empty sidebar. |
| R9 | 🟠 | Home | No "vs previous period" under the totals (H3); "Unread messages" card alone in a half-empty row (H2); recent-orders badges still use the old styles, not the new tones (A6); top product named "Item". |
| R10 | 🟠 | Settings → Roles | "Delete" is offered on built-in roles (the server refuses it). |
| R11 | 🟠 | Settings → Activity | Actions are shown as stored English text ("import products") in every admin language. |
| R12 | 🟠 | Settings | "Default" badge still under every field (S1); Staff, Roles and Activity aren't in the settings section list and drop the settings layout; no Domains entry. |
| R13 | 🟠 | Checkout | Still no taxes / "VAT included" line in the summary (X9). |
| R14 | 🟡 | Categories | Flat list with no product counts; nesting isn't visible (C2 not confirmed). |
| R15 | 🟡 | Orders list | Selecting a row replaces the column headers and the columns jump sideways. |
| R16 | 🟡 | Orders and messages on phones | No total or date on order rows; no date on message rows. |
| R17 | 🟡 | Product editor | Takes ~6 s to open in dev with no loading feedback (partly dev compiling; check in a production build). |
| R18 | 🟡 | Repo root | Stray log files (`admin-err.log`, `pb-out.log`, `lintf.log`…) are untracked and not git-ignored. |

## Not checked in round 2

- Anything that saves (orders, products, settings, staff, roles), placing an order, the customer account pages.
- Demo mode ("Try the demo", read-only refusals): `DEMO_MODE` isn't set locally.
- Light mode, Italian and Spanish screens (dictionaries are complete: no missing keys).
- Supabase and SQLite backends.

## Round 2 fixes (3 Nov 2026)

All of R1–R18 are fixed and were checked in the browser (R12 on a production build: the running dev server kept an old copy of the settings layout after its folder moved; restart `npm run dev:admin`). Notes:
- R8: the "bigger font" was a screenshot artifact (every input is 14px); the cut-off SKUs and color names and the narrow card were real and are fixed.
- R9: existing demo orders keep the item title "Item" until `npm run demo:reset`; new demo data uses the product's own title.
- R14: nesting works; the local categories simply have no parents.
- R17: 0.2 s in a production build; the 6 s was dev compiling. Every list and detail page now has a page-shaped skeleton.
- R18: `*.log` and `/*.err` are git-ignored (files not deleted).

