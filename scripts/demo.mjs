// Seeds (or resets) the public demo: the demo admin, sample customers, orders in every status
// and messages. Backend-neutral (see seed-backend.mjs). Safe to re-run; `--reset` clears demo
// data first. Usage: npm run demo:seed | npm run demo:reset
import { randomBytes } from "node:crypto";

import { getSeedBackend } from "./seed-backend.mjs";
import { seedCatalog } from "./seed-catalog.mjs";

process.loadEnvFile(".env.local");

const DEMO_EMAIL = "demo@admin.com";
const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? "jkdvPfuPrpetttcS";
const RESET = process.argv.includes("--reset");

// The demo role can view everything but change nothing (is_read_only).
const DEMO_PERMISSIONS = [
  "dashboard.view",
  "analytics.view",
  "products.view",
  "inventory.view",
  "categories.view",
  "collections.view",
  "gift_cards.view",
  "reviews.view",
  "orders.view",
  "draft_orders.view",
  "discounts.view",
  "customers.view",
  "messages.view",
  "settings.view",
  "users.view",
  "roles.view",
  "audit.view",
  "themes.view",
  "pages.view",
];

const CUSTOMERS = [
  { name: "Sofia Rossi", email: "sofia@example.com", city: "Milan", country: "IT" },
  { name: "Marco Bianchi", email: "marco@example.com", city: "Rome", country: "IT" },
];

const ORDER_STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
const PAYMENT_FOR = {
  pending: "unpaid",
  paid: "paid",
  processing: "paid",
  shipped: "paid",
  delivered: "paid",
  cancelled: "unpaid",
  refunded: "refunded",
};

const MESSAGES = [
  {
    name: "Sofia Rossi",
    email: "sofia@example.com",
    subject: "Where is my order?",
    message: "Hi, could you tell me when order #1004 will ship?",
  },
  {
    name: "Marco Bianchi",
    email: "marco@example.com",
    subject: "Return",
    message: "The belt is too big, how do I return it?",
  },
  {
    name: "Elena Verdi",
    email: "elena@example.com",
    subject: "Restock",
    message: "Will the wool coat be back in size M soon?",
  },
];

function address(customer) {
  return {
    full_name: customer.name,
    phone: "+39 300 000 0000",
    line1: "Via Roma 1",
    city: customer.city,
    region: customer.city,
    postal_code: "00100",
    country: customer.country,
  };
}

const backend = await getSeedBackend();

if (RESET) await backend.clearDemoData();

await backend.upsertRole({
  name: "demo",
  description: "Read-only demo",
  permissions: DEMO_PERMISSIONS,
  is_system: false,
  is_read_only: true,
});
const { id: demo_user_id } = await backend.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo" });
await backend.setTeamMember({ user_id: demo_user_id, roles: ["demo"], is_admin: false, is_active: true });

await seedCatalog(backend);

const customers = [];
for (const customer of CUSTOMERS) {
  const { id } = await backend.createUser({
    email: customer.email,
    // Nobody needs to sign in as the sample customers, so their passwords are random.
    password: randomBytes(18).toString("base64url"),
    name: customer.name,
    accepts_marketing: true,
  });
  customers.push({ ...customer, user: { id } });
}

const products = await backend.listProducts();
if (products.length === 0) throw new Error("No products: run `npm run seed` first.");
const variants = await backend.listVariants();
let number = await backend.nextOrderNumber();

// The order's history up to its final status, so its page shows a real timeline and dates:
// placed (pending), then each step. Card orders are paid at once; refunds follow payment.
const STEPS = {
  pending: [],
  paid: ["paid"],
  processing: ["paid", "processing"],
  shipped: ["paid", "processing", "shipped"],
  delivered: ["paid", "processing", "shipped", "delivered"],
  cancelled: ["cancelled"],
  refunded: ["paid", "refunded"],
};
const HOUR_MS = 3_600_000;

function history(status, placed_at, gap_ms) {
  const at = (step) => new Date(placed_at.getTime() + (step + 1) * gap_ms).toISOString();
  const steps = STEPS[status];
  const events = [{ type: "created", from_status: "", to_status: "pending", is_customer_visible: true }];
  let from = "pending";
  steps.forEach((to) => {
    events.push({
      type: to === "shipped" ? "shipped" : "status_changed",
      from_status: from,
      to_status: to,
      is_customer_visible: true,
    });
    from = to;
  });
  const when = (to) => (steps.includes(to) ? at(steps.indexOf(to)) : null);
  return {
    events,
    paid_at: when("paid"),
    shipped_at: when("shipped"),
    delivered_at: when("delivered"),
    cancelled_at: when("cancelled"),
  };
}

let order_index = 0;
for (const status of ORDER_STATUSES) {
  // SQL backends: orders spread over the last two weeks, steps 6 h apart. PocketBase sets created_at
  // itself (now), so there the steps follow a minute apart and no date comes before "placed".
  const placed_at = backend.can_backdate
    ? new Date(Date.now() - (ORDER_STATUSES.length - order_index++) * 2 * 24 * HOUR_MS)
    : new Date();
  const { events, ...timestamps } = history(status, placed_at, backend.can_backdate ? 6 * HOUR_MS : 60_000);
  const customer = customers[number % customers.length];
  const product = products[number % products.length];
  const variant = variants.find((item) => item.product_id === product.id) ?? variants[0];
  const payment_status = PAYMENT_FOR[status];
  const payment_method = status === "refunded" ? "card" : "cash_on_delivery";
  const total = product.price + 500;

  await backend.createOrder({
    order_number: number++,
    user_id: customer.user.id,
    email: customer.email,
    phone: address(customer).phone,
    locale: "en",
    status,
    payment_status,
    payment_method,
    currency: "EUR",
    subtotal: product.price,
    shipping_total: 500,
    tax_total: 0,
    discount_total: 0,
    cod_fee: 0,
    total,
    shipping_address: address(customer),
    billing_address: address(customer),
    shipping_method: "Standard",
    created_at: placed_at.toISOString(),
    ...timestamps,
    item: {
      product_id: product.id,
      variant_id: variant?.id ?? null,
      title: product.title,
      variant_label: `${variant?.color ?? ""} / ${variant?.size ?? ""}`,
      sku: variant?.sku ?? "",
      unit_price: product.price,
      quantity: 1,
      line_total: product.price,
    },
    payment:
      payment_status === "paid" || payment_status === "refunded"
        ? {
            provider: payment_method,
            amount: total,
            currency: "EUR",
            status: payment_status === "refunded" ? "refunded" : "succeeded",
          }
        : null,
    events,
  });
}

for (const message of MESSAGES) {
  await backend.createMessage({ ...message, status: "new" });
}

// Online store: Atelier live (published), Bold in the library as a draft to try, a custom page
// and a header menu, so the theme editor and Pages have something to show. Theme data `{}` reads
// as the template's defaults.
const now = new Date().toISOString();
await backend.replaceThemes([
  {
    name: "Atelier",
    template: "atelier",
    draft: {},
    published: {},
    history: [{ published_at: now, data: {} }],
    is_live: true,
    published_at: now,
  },
  { name: "Bold", template: "bold", draft: {}, published: null, history: [], is_live: false, published_at: "" },
]);

const text = (en, es, it) => ({ en, es, it });
await backend.upsertPage({
  slug: "size-guide",
  title: text("Size guide", "Guía de tallas", "Guida alle taglie"),
  is_published: true,
  seo: {
    title: {},
    description: text("How our sizes fit.", "Cómo quedan nuestras tallas.", "Come vestono le nostre taglie."),
  },
  sections: [
    {
      id: "header",
      type: "page_header",
      is_hidden: false,
      settings: {
        eyebrow: text("Help", "Ayuda", "Aiuto"),
        heading: text("Size guide", "Guía de tallas", "Guida alle taglie"),
        subtitle: text(
          "Our pieces follow standard European sizes. When in doubt, size up.",
          "Nuestras prendas siguen las tallas europeas estándar. Si dudas, elige una talla más.",
          "I nostri capi seguono le taglie europee standard. Nel dubbio, scegli una taglia in più.",
        ),
        alignment: "left",
      },
    },
    {
      id: "table",
      type: "rich_text",
      is_hidden: false,
      settings: {
        heading: text("Women", "Mujer", "Donna"),
        body: text(
          "- XS: chest 82 cm, waist 64 cm\n- S: chest 86 cm, waist 68 cm\n- M: chest 90 cm, waist 72 cm\n- L: chest 96 cm, waist 78 cm",
          "- XS: pecho 82 cm, cintura 64 cm\n- S: pecho 86 cm, cintura 68 cm\n- M: pecho 90 cm, cintura 72 cm\n- L: pecho 96 cm, cintura 78 cm",
          "- XS: petto 82 cm, vita 64 cm\n- S: petto 86 cm, vita 68 cm\n- M: petto 90 cm, vita 72 cm\n- L: petto 96 cm, vita 78 cm",
        ),
        alignment: "left",
      },
    },
    {
      id: "faq",
      type: "faq",
      is_hidden: false,
      settings: {
        heading: text("Questions", "Preguntas", "Domande"),
        items: [
          {
            id: "fit",
            question: text("Do your clothes run small?", "¿Las prendas son pequeñas?", "I capi vestono piccoli?"),
            answer: text(
              "Most pieces are true to size; coats have room for a sweater underneath.",
              "La mayoría son de talla normal; los abrigos dejan espacio para un jersey.",
              "La maggior parte veste regolare; i cappotti lasciano spazio per un maglione.",
            ),
          },
          {
            id: "exchange",
            question: text("Can I exchange a size?", "¿Puedo cambiar de talla?", "Posso cambiare taglia?"),
            answer: text(
              "Yes, within the return window. Write to us from the contact page.",
              "Sí, dentro del plazo de devolución. Escríbenos desde la página de contacto.",
              "Sì, entro il periodo di reso. Scrivici dalla pagina contatti.",
            ),
          },
        ],
      },
    },
  ],
});

const link = (id, label, href, children = []) => ({ id, label, href, children });
await backend.saveSetting({
  key: "NAVIGATION",
  category: "navigation",
  is_public: true,
  value: {
    header: [
      link("shop", text("Shop all", "Ver todo", "Vedi tutto"), "/shop", [
        { id: "new", label: text("New arrivals", "Novedades", "Novità"), href: "/shop?sort=newest" },
      ]),
      link("women", text("Women", "Mujer", "Donna"), "/shop?category=women"),
      link("men", text("Men", "Hombre", "Uomo"), "/shop?category=men"),
      link("accessories", text("Accessories", "Accesorios", "Accessori"), "/shop?category=accessories"),
      link("size-guide", text("Size guide", "Guía de tallas", "Guida alle taglie"), "/pages/size-guide"),
    ],
    footer: { columns: [], about_text: {}, show_contact: true, show_payments: true },
  },
});

await backend.close();

console.warn(`Demo ready (${RESET ? "reset" : "seeded"}): ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
