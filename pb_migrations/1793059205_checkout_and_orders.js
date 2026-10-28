/// <reference path="../pb_data/types.d.ts" />

// Discount codes, checkout sessions, orders, order items, order events and payments.
// All money is integer cents. Only the server (superuser client) writes these.
migrate(
  (app) => {
    const users_id = app.findCollectionByNameOrId("users").id;
    const products_id = app.findCollectionByNameOrId("products").id;
    const variants_id = app.findCollectionByNameOrId("product_variants").id;
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];
    const cents = (name) => ({ type: "number", name, onlyInt: true, min: 0 });
    const payment_methods = ["card", "cash_on_delivery"];
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    const own_order = '@request.auth.id != "" && order.user = @request.auth.id';

    const discount_codes = new Collection({
      type: "base",
      name: "discount_codes",
      ...locked,
      fields: [
        { type: "text", name: "code", required: true, max: 50, pattern: "^[A-Z0-9_-]+$" },
        { type: "select", name: "type", required: true, maxSelect: 1, values: ["percent", "fixed"] },
        // Percent (1-100) for "percent", cents for "fixed".
        { type: "number", name: "value", onlyInt: true, min: 0 },
        cents("min_subtotal"),
        { type: "date", name: "starts_at" },
        { type: "date", name: "ends_at" },
        { type: "number", name: "usage_limit", onlyInt: true, min: 0 },
        { type: "number", name: "used_count", onlyInt: true, min: 0 },
        { type: "bool", name: "is_active" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_discount_codes_code ON discount_codes (code)"],
    });
    app.save(discount_codes);

    const checkout_sessions = new Collection({
      type: "base",
      name: "checkout_sessions",
      ...locked,
      fields: [
        { type: "relation", name: "user", collectionId: users_id, maxSelect: 1, cascadeDelete: false },
        { type: "email", name: "email" },
        { type: "text", name: "phone", max: 30 },
        { type: "text", name: "locale", max: 5 },
        // Server-priced snapshot: [{ variant_id, product_id, title, variant_label, sku, image, unit_price, quantity, line_total }]
        { type: "json", name: "line_items" },
        cents("subtotal"),
        cents("shipping_total"),
        cents("tax_total"),
        cents("discount_total"),
        cents("cod_fee"),
        cents("total"),
        { type: "text", name: "currency", max: 3 },
        {
          type: "relation",
          name: "discount_code",
          collectionId: discount_codes.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { type: "json", name: "shipping_address" },
        { type: "json", name: "billing_address" },
        { type: "text", name: "shipping_method", max: 100 },
        { type: "select", name: "payment_method", maxSelect: 1, values: payment_methods },
        {
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["open", "completed", "expired", "failed"],
        },
        { type: "json", name: "attribution" },
        { type: "date", name: "expires_at" },
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_checkout_sessions_status ON checkout_sessions (status)"],
    });
    app.save(checkout_sessions);

    const orders = new Collection({
      type: "base",
      name: "orders",
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        // Assigned by pb_hooks/orders.pb.js.
        { type: "number", name: "order_number", onlyInt: true, min: 0 },
        // Empty for guest orders.
        { type: "relation", name: "user", collectionId: users_id, maxSelect: 1, cascadeDelete: false },
        { type: "email", name: "email", required: true },
        { type: "text", name: "phone", max: 30 },
        { type: "text", name: "locale", max: 5 },
        {
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"],
        },
        {
          type: "select",
          name: "payment_status",
          required: true,
          maxSelect: 1,
          values: ["unpaid", "paid", "failed", "refunded"],
        },
        { type: "select", name: "payment_method", maxSelect: 1, values: payment_methods },
        { type: "text", name: "currency", max: 3 },
        cents("subtotal"),
        cents("shipping_total"),
        cents("tax_total"),
        cents("discount_total"),
        cents("cod_fee"),
        cents("total"),
        {
          type: "relation",
          name: "discount_code",
          collectionId: discount_codes.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { type: "json", name: "shipping_address" },
        { type: "json", name: "billing_address" },
        { type: "text", name: "shipping_method", max: 100 },
        { type: "text", name: "customer_note", max: 2000 },
        // Staff-only fields: hidden from every non-superuser API response.
        { type: "text", name: "internal_note", max: 5000, hidden: true },
        { type: "json", name: "attribution", hidden: true },
        { type: "text", name: "tracking_number", max: 100 },
        { type: "text", name: "carrier", max: 100 },
        { type: "url", name: "tracking_url" },
        {
          type: "relation",
          name: "checkout_session",
          collectionId: checkout_sessions.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { type: "date", name: "paid_at" },
        { type: "date", name: "shipped_at" },
        { type: "date", name: "delivered_at" },
        { type: "date", name: "cancelled_at" },
        { type: "date", name: "deleted_at" },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_orders_order_number ON orders (order_number)",
        "CREATE UNIQUE INDEX idx_orders_checkout_session ON orders (checkout_session) WHERE checkout_session != ''",
        "CREATE INDEX idx_orders_user ON orders (user)",
        "CREATE INDEX idx_orders_status ON orders (status)",
        "CREATE INDEX idx_orders_created_at ON orders (created_at)",
      ],
    });
    app.save(orders);

    const order_items = new Collection({
      type: "base",
      name: "order_items",
      listRule: own_order,
      viewRule: own_order,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "relation", name: "order", required: true, collectionId: orders.id, maxSelect: 1, cascadeDelete: true },
        { type: "relation", name: "product", collectionId: products_id, maxSelect: 1, cascadeDelete: false },
        { type: "relation", name: "variant", collectionId: variants_id, maxSelect: 1, cascadeDelete: false },
        // Snapshot at purchase time, so later product edits don't change past orders.
        { type: "text", name: "title", required: true, max: 300 },
        { type: "text", name: "variant_label", max: 100 },
        { type: "text", name: "sku", max: 64 },
        { type: "text", name: "image", max: 500 },
        cents("unit_price"),
        { type: "number", name: "quantity", onlyInt: true, min: 1 },
        cents("line_total"),
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_order_items_order ON order_items (order)"],
    });
    app.save(order_items);

    const order_events = new Collection({
      type: "base",
      name: "order_events",
      listRule: own_order + " && is_customer_visible = true",
      viewRule: own_order + " && is_customer_visible = true",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "relation", name: "order", required: true, collectionId: orders.id, maxSelect: 1, cascadeDelete: true },
        {
          type: "select",
          name: "type",
          required: true,
          maxSelect: 1,
          values: ["created", "status_changed", "payment_status_changed", "note", "shipped", "email_sent"],
        },
        { type: "text", name: "from_status", max: 30 },
        { type: "text", name: "to_status", max: 30 },
        { type: "text", name: "message", max: 2000 },
        { type: "relation", name: "actor", collectionId: users_id, maxSelect: 1, cascadeDelete: false },
        { type: "bool", name: "is_customer_visible" },
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_order_events_order ON order_events (order)"],
    });
    app.save(order_events);

    const payments = new Collection({
      type: "base",
      name: "payments",
      ...locked,
      fields: [
        { type: "relation", name: "order", collectionId: orders.id, maxSelect: 1, cascadeDelete: false },
        {
          type: "relation",
          name: "checkout_session",
          collectionId: checkout_sessions.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          type: "select",
          name: "provider",
          required: true,
          maxSelect: 1,
          values: ["card", "cash_on_delivery", "stripe"],
        },
        { type: "text", name: "provider_ref", max: 200 },
        cents("amount"),
        { type: "text", name: "currency", max: 3 },
        {
          type: "select",
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["pending", "succeeded", "failed", "refunded"],
        },
        { type: "text", name: "error_code", max: 100 },
        { type: "json", name: "raw" },
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_payments_order ON payments (order)"],
    });
    app.save(payments);
  },
  (app) => {
    for (const name of ["payments", "order_events", "order_items", "orders", "checkout_sessions", "discount_codes"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
