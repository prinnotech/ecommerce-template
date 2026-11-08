# Phase 9 plan: the rest of the Shopify features

**Status: built 2026-11-07, not yet tested in the browser (phase 10).** Changes from the plan: reviews are a fixed part of the product block instead of a theme section; the demo role doesn't get `api_keys.view`; the MCP endpoint lives in the admin app (`/api/mcp`), with the tools in `packages/mcp`; the cron route is `/api/cron/abandoned-checkouts`. Decisions: pixels wait for consent; gift cards are sold as products and pay at checkout; reviews from verified buyers only, approved by staff; abandoned-checkout emails by button plus an optional automatic send (cron). Phase 8's four small fixes are done: order stock in the inventory history, Drafts in the menu without Orders, no default country on draft addresses, and `CLAUDE.md`.

Everything is written for all three backends (PocketBase, Supabase, SQLite), in en/es/it, from the `admin-ui` components. Testing happens once, at the end (phase 10).

## Order of work

| # | Feature | What it adds | Schema |
|---|---|---|---|
| 1 | **Discounts** (Marketing → Discounts) | A list with status (active, scheduled, expired, used up), search and usage counts. The editor has the code (or "generate"), percentage, fixed amount or **free shipping**, minimum order, start/end dates, total limit, **once per customer**, and an optional limit to some products or categories. The checkout applies the new rules. | New columns on `discount_codes`: `title`, `applies_to` (json), `once_per_customer`, `deleted_at` |
| 2 | **Product SEO** | A "Search engine listing" card on products, categories and custom pages: title, description, URL handle and a Google-style preview. `generateMetadata` uses these values, falling back to the current text. | `seo` json on `products` and `categories` (`pages` already has one) |
| 3 | **Shipping zones and taxes per country** (Settings → Shipping, Taxes) | Zones (for example "Italy", "EU", "Rest of world"), each with countries, its own rates (flat, free over an amount, or by order value) and its own tax rate. The checkout shows the rates for the delivery country and re-prices when the country changes. Old settings become one "Everywhere" zone when read. | Settings only (`SHIPPING_ZONES`, `TAX_RATES`), no tables |
| 4 | **Abandoned checkouts** (Orders → Abandoned checkouts) | The checkout saves the email as soon as it's typed. A list shows sessions older than 1 hour that were never paid, with "Send recovery email" (a new `abandoned_checkout` template with a link back to the same checkout, which stays open for 7 days). An optional automatic email after N hours runs from a cron route (`/api/cron/abandoned`, protected by `CRON_SECRET`). | `checkout_sessions`: `recovery_sent_at`, `contact_at` |
| 5 | **Ad tracking and cookie consent** | Settings → Tracking holds the GTM / Google tag id, Meta Pixel id and Google Ads conversion label. The Meta CAPI token is a secret, encrypted like Stripe's. UTM and click-id capture goes in the store's proxy and is saved on orders. Browser + server Purchase events share one `event_id`. A cookie banner asks first, and pixels wait for consent (EU default). | `orders.attribution` (already there) |
| 6 | **Reports** (Analytics) | Date range with comparison to the previous period: sales over time, orders, average order value, returning-customer rate, top products, sales by category, discount usage, and sessions converted (checkouts started → orders). Charts drawn as SVG by hand (no chart library), each with a table view. | None (computed from orders) |
| 7 | **Returns and partial refunds** | On the order page, "Refund" opens a dialog: choose items and quantities and/or an amount, whether to restock, a reason, and whether to notify the customer. Stripe orders refund that amount through Stripe. The order gets `partially_refunded` until everything is refunded, and the timeline lists each refund. | New `refunds` table (lines json, amount, reason, restocked, provider_ref); `orders.refunded_total`; new payment status `partially_refunded` |
| 8 | **Collections** (Products → Collections) | Manual collections (pick products, drag to order) and automatic ones (rules: tag, category, price, on sale, in stock; match all or any). Each has a title, description, image, SEO, and a store page at `/[lang]/collections/[slug]` that works with the shop filters. Theme sections can show a collection. | New `collections` and `collection_products` tables |
| 9 | **Gift cards** (Products → Gift cards) | Staff issue cards (code, amount, expiry, optional customer email, with a `gift_card` email), and the catalog can sell gift-card products. At checkout a gift card code pays all or part of the total; Stripe charges the rest. Cards keep a balance and a transaction history. | New `gift_cards` and `gift_card_transactions` tables; `orders.gift_card_total` |
| 10 | **Product reviews** | Signed-in customers who bought the product can review it with stars, a title and text. Staff moderate under Products → Reviews (approve, hide, reply). The product page shows the average and approved reviews, plus a theme section. Product JSON-LD includes the rating. | New `reviews` table |
| 11 | **Wishlist** | A heart on product cards and the product page. Guests keep it in the browser; signed-in customers have it saved to their account, merged when they sign in. Account → Wishlist page. | New `wishlist_items` table |
| 12 | **MCP server** | A separate package (`packages/mcp`): Claude signs in with a staff API key and gets tools for orders, products, stock, drafts, customers and discounts. It goes through the same actions and permissions. | New `api_keys` table (hashed), Settings → API keys |

Every new table gets locked API rules in PocketBase and RLS in Supabase, like the others. Writes go through the admin client after `authorize()`.

## New permissions

`discounts.view/edit`, `analytics.view`, `collections.view/edit`, `gift_cards.view/edit`, `reviews.view/edit`, `api_keys.edit`, plus `orders.refund` (already there) for partial refunds. The demo role gets the `.view` ones.

## Needs your OK

- **Migrations:** one SQL migration and one PocketBase migration per feature, all new (none of the old ones change).
- **No new dependencies**, except the MCP server, which needs `@modelcontextprotocol/sdk`. I'll ask again when I get there.
- **New env variables:** `CRON_SECRET` (abandoned-checkout emails), plus the tracking ids go in Settings, not env.
- **Checkout changes:** discounts (1), shipping zones (3), the gift card field (9) and the early email save (4) all change the checkout.

## Decisions

Recommended defaults in **bold**:

1. **Cookie consent:** **pixels wait for consent** (needed in the EU) / pixels load straight away.
2. **Gift cards:** **can pay at checkout and can be sold as products** / issued by staff only, paid at checkout.
3. **Reviews:** **verified buyers only, staff approve before they show** / any signed-in customer, shown at once.
4. **Abandoned-checkout email:** **manual button plus optional automatic email (needs a cron job on your host)** / manual button only.
