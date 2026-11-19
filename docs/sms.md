# SMS and WhatsApp

**Settings → SMS & WhatsApp** sends order updates by text message and WhatsApp through the store owner's own [Twilio](https://www.twilio.com) account. Each message is billed by Twilio to that account.

## Setting it up

1. **Account:** copy the **Account SID** (`AC…`) and the **Auth token** from the Twilio Console's home page.
   - The token is stored encrypted and never shown again.
   - Setting `TWILIO_AUTH_TOKEN` on the server wins over the typed one.
2. **Senders:**
   - **SMS:** a Twilio phone number (`+1…`) or a Messaging Service SID (`MG…`).
   - **WhatsApp:** your WhatsApp-enabled Twilio number. For testing, the Twilio sandbox number works.
   - Leave one empty to use only the other channel.
3. **Default country code** (for example `+39`): added to numbers customers type without one. The national leading 0 is dropped, except for Italy, San Marino and the Vatican, where it's part of the number.
4. **Staff phones:** the numbers that get the staff alerts, one per line, with the country code.
5. **Save**, then **Send a test**.

## Messages

| Message | Goes to | When |
|---|---|---|
| Order confirmed | Customer | The order is placed (checkout, card payment, draft order) |
| Order shipped | Customer | The order is marked shipped, with the tracking number |
| Order delivered | Customer | The order is marked delivered |
| Order cancelled | Customer | The order is cancelled |
| Order refunded | Customer | All or part of the order is refunded |
| New order | Staff phones | Every new order |
| Low stock | Staff phones | An order takes a variant down to the low-stock level (Products → Inventory) or below, once per drop |

Each message has its own **SMS** and **WhatsApp** switch.

**Consent:** customers get messages only if they ticked *Text me updates about this order* at checkout and gave a phone number in their delivery address. The box appears only while at least one customer message is switched on.

## Texts and templates

**SMS:** one text per store language, with the same `{{placeholders}}` as the emails (`{{order_number}}`, `{{tracking_link}}`…).
- A line whose placeholder has no value is left out, as in the emails.
- The character count shows roughly how many SMS a text costs (160 characters for one, 153 per part after that). Accents and emoji can make each part shorter.

**WhatsApp:** messages a business starts must use a template Meta approved.
1. Create the template in Twilio → **Content Template Builder**, with variables `{{1}}`, `{{2}}`…
2. Wait for Meta's approval.
3. Paste its **Content SID** (`HX…`) into the message.
4. Choose what fills each variable.

Without a Content SID, the WhatsApp switch sends nothing.

**WhatsApp test:** the test sends plain text, so it only arrives if that number wrote to your WhatsApp sender in the last 24 hours. With the sandbox, that means after sending the join code.

## Log

**Recent messages** on the settings screen lists every message, with Twilio's reason when one fails. Messages also show on each order's timeline.

**Not sent** means the message never reached Twilio, for one of these reasons:
- Twilio isn't set up.
- The phone number isn't valid.
- The WhatsApp message has no template.

## Not included

**Abandoned checkouts:** these get no message. The phone and the consent are only saved when the order is placed.

## For developers

- **Setting:** `MESSAGING` in `lib/schemas/messaging.ts`.
- **Secret:** `TWILIO_AUTH_TOKEN` in `lib/secrets.ts`.
- **Sending:** `lib/messaging/twilio.ts` calls Twilio's REST API with `fetch` and logs to `message_log`. It never throws.
- **Order events:** `lib/messaging/order-messages.ts`, called from `sendOrderEmails()` after the response. `notifyLowStock()` runs from `placeSessionOrder()`.
- **Schema:**
  - `message_log` table.
  - `sms_opt_in` on `checkout_sessions` and `orders`.
  - Migrations: `pb_migrations/1793059224_messages.js` and `0019_messages` in `packages/backend-sql/migrations.ts`.
