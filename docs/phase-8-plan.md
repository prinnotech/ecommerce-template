# Phase 8 plan: Shopify-style settings, payments, emails, inventory, draft orders

**Status: built (2026-11-06).** Secrets: in the admin, encrypted. Stripe: Checkout Sessions (Elements) + webhook. Verified on PocketBase: settings panel, payments screen, email settings and templates, inventory, draft orders (invoice through a local SMTP sink, then the store checkout). **Not verified yet:** Stripe in test mode (needs test keys), a real SMTP server, Supabase and SQLite click-throughs (both type-check and share the SQL code).

## 1. Settings as a full panel (like Shopify)

Clicking **Settings** opens a full-screen panel over the admin, with its own left-hand list and a close button (✕) back to where you were:

| Group | Sections |
|---|---|
| Store | Store details (name, logo, contact, address), Languages, Domains |
| Selling | **Payments**, Checkout, **Shipping and delivery**, Taxes |
| Customers and emails | **Notifications** (email templates and automations), **Email sending** (SMTP) |
| Team | Staff, Roles, Activity |
| Legal | Policies (privacy, terms) |
| You | Profile |

Every current setting moves into one of these, so nothing is lost. A new full-screen route group `apps/admin/app/(settings)`, like the theme editor's, replaces the current settings pages.

## 2. Payments (Settings → Payments)

Payment methods become a list you build, like Shopify's:

- **Card (Stripe).** Connect with your Stripe keys. The checkout shows Stripe's card form (Payment Element, which also offers Apple Pay and Google Pay where available). A **webhook** (`/api/stripe/webhook`) confirms the payment, so the order is marked paid even if the customer closes the page. Refunds from the order page go through Stripe.
- **Cash on delivery.** As today, with its optional fee.
- **Manual payment methods.** As many as you want: bank transfer, PayPal.me, pay in store… Each has:
  - a name and instructions in en/es/it
  - an optional fee
  - on/off

  The order is placed as **unpaid**, with the instructions on the thank-you page and in the confirmation email. You press **Mark as paid** when the money arrives.
- **Checkout:** shows only the enabled methods, in the order you set.

The old `card` placeholder (always declined) is removed.

## 3. Emails

- **Email sending (SMTP):** host, port, encryption, username, password and the "from" name and address. A **Send test email** button. Without SMTP set up, emails are skipped and a warning shows on the Notifications page.
- **Notifications**, each with an on/off switch, its subject and body editable per language, a preview, and "send me a test":

  | Email | Sent when |
  |---|---|
  | Order confirmation | an order is placed (includes payment instructions for manual methods) |
  | Payment received | an unpaid order is marked paid |
  | Order shipped | the order is shipped (with carrier and tracking link) |
  | Order delivered | the order is marked delivered |
  | Order cancelled | the order is cancelled |
  | Refund | a refund is made |
  | Draft order invoice | sent from a draft order, with a payment link |
  | **New order (to staff)** | an order is placed: to the addresses you choose |

- **Templates:** plain text with placeholders (`{{customer_name}}`, `{{order_number}}`, `{{order_total}}`, `{{order_link}}`, `{{tracking_link}}`, `{{payment_instructions}}`…). They're placed in a clean HTML layout that uses the store's logo, colours and contact details. The order's items and totals are added automatically.
- **Sending:** happens after the action answers, so a slow mail server never slows the checkout. Every send is listed in a **Email log** (sent / failed, with the reason).
- **Password-reset emails:** stay with each backend's auth for now (PocketBase sends its own; Supabase too).

## 4. Inventory (Products → Inventory)

- **The screen:** every variant in one table: product, size/colour, SKU, stock. Filters (low stock, out of stock, by category), search, and **inline editing** of stock (set or add/remove).
- **Low-stock threshold:** a setting, shown as a badge.
- **History:** every change is logged, with who changed it and why ("Received", "Correction", "Damaged", or an order).

## 5. Draft orders (Orders → Drafts)

- **Create an order by hand:**
  - pick a customer (or type a new one) and add products and variants
  - add a custom line (name and price)
  - optionally override the shipping price, and add a discount
- **Totals** are computed by the same server rules as the checkout.
- **Then either:**
  - **Send invoice:** an email with a payment link to the store's checkout, prefilled
  - **Mark as paid:** creates the order and takes the stock
  - **Mark as pending:** creates an unpaid order, for cash or manual payment
- **Drafts are kept** until completed or deleted.

## How it's built

- **New tables** (PocketBase + SQL migration):
  - `payment_methods` (manual methods, card, COD with their order and texts)
  - `email_templates`
  - `email_log`
  - `inventory_adjustments`
  - `draft_orders`
- **Orders:** `orders.payment_method` becomes free text (the method's id), with a copy of the method's name kept on the order.
- **Payments:** one interface in `packages/core/lib/payments/`: `card_stripe`, `cash_on_delivery`, `manual`.
- **Email:** `packages/core/lib/email/` (SMTP transport, layout, templates, placeholders), triggered from the order actions and the Stripe webhook.
- **Permissions:**
  - `settings.view` / `settings.edit` (already exist) cover the panel
  - new: `inventory.view` / `inventory.edit` and `draft_orders.view` / `draft_orders.edit`
- **Text:** in en/es/it.

## Order of work

1. Settings panel (move everything, no new features yet).
2. Payments: methods list, manual methods, COD, checkout changes.
3. Stripe: card payments, webhook, refunds.
4. SMTP + notifications + email log.
5. Inventory screen.
6. Draft orders.
7. Lint, typecheck, build, click-through (Stripe in test mode, SMTP with a test inbox).

## Needs your OK

- **New dependencies:**
  - `nodemailer` (SMTP sending)
  - `stripe` (server)
  - `@stripe/stripe-js` + `@stripe/react-stripe-js` (the card form)
- **Five new tables** and the `orders.payment_method` change, all through migrations.
- **Where the SMTP password and the Stripe secret key live** (decision below).
- **For testing Stripe:** a Stripe account in **test mode** (test keys). For SMTP: a test inbox, e.g. a free Mailtrap or Ethereal account, or your own SMTP.
