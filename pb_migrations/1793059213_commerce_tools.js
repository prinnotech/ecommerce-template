/// <reference path="../pb_data/types.d.ts" />

// Payments, emails, inventory and draft orders (same changes as 0008_emails_inventory_drafts in
// packages/backend-sql/migrations.ts):
// - payment methods are a list in Settings → Payments, so orders.payment_method,
//   checkout_sessions.payment_method and payments.provider become free text (a method's id);
// - checkout_sessions.customer_note (a card order is placed later, by the Stripe webhook);
// - email_log, inventory_adjustments, draft_orders: locked, server only.
migrate(
  (app) => {
    // A select field can't change type in place: copy it into a new text field, then swap.
    const toText = (collection_name, field_name) => {
      const collection = app.findCollectionByNameOrId(collection_name);
      const old_field = collection.fields.getByName(field_name);
      if (!old_field || old_field.type() === "text") return;
      const temp_name = `${field_name}_text`;
      collection.fields.add(new TextField({ name: temp_name, max: 60 }));
      app.save(collection);
      for (const record of app.findAllRecords(collection_name)) {
        record.set(temp_name, record.getString(field_name));
        app.saveNoValidate(record);
      }
      const updated = app.findCollectionByNameOrId(collection_name);
      updated.fields.removeByName(field_name);
      updated.fields.getByName(temp_name).name = field_name;
      app.save(updated);
    };
    toText("orders", "payment_method");
    toText("checkout_sessions", "payment_method");
    toText("payments", "provider");

    const sessions = app.findCollectionByNameOrId("checkout_sessions");
    sessions.fields.add(new TextField({ name: "customer_note", max: 2000 }));
    app.save(sessions);

    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];
    const orders = app.findCollectionByNameOrId("orders");
    const variants = app.findCollectionByNameOrId("product_variants");
    const users = app.findCollectionByNameOrId("users");

    app.save(
      new Collection({
        type: "base",
        name: "email_log",
        ...locked,
        fields: [
          { type: "text", name: "template", required: true, max: 60 },
          { type: "text", name: "recipient", required: true, max: 320 },
          { type: "text", name: "subject", max: 500 },
          { type: "text", name: "status", required: true, max: 20 },
          { type: "text", name: "error", max: 2000 },
          { type: "relation", name: "order", collectionId: orders.id, maxSelect: 1, cascadeDelete: false },
          ...timestamps,
        ],
        indexes: ["CREATE INDEX idx_email_log_created_at ON email_log (created_at)"],
      }),
    );

    app.save(
      new Collection({
        type: "base",
        name: "inventory_adjustments",
        ...locked,
        fields: [
          { type: "relation", name: "variant", collectionId: variants.id, maxSelect: 1, cascadeDelete: true },
          { type: "number", name: "delta", onlyInt: true },
          { type: "number", name: "stock_after", onlyInt: true },
          { type: "text", name: "reason", required: true, max: 40 },
          { type: "text", name: "note", max: 500 },
          { type: "text", name: "actor_id", max: 40 },
          ...timestamps,
        ],
        indexes: ["CREATE INDEX idx_inventory_adjustments_variant ON inventory_adjustments (variant)"],
      }),
    );

    app.save(
      new Collection({
        type: "base",
        name: "draft_orders",
        ...locked,
        fields: [
          { type: "number", name: "draft_number", onlyInt: true, min: 1 },
          { type: "text", name: "status", required: true, max: 20 },
          { type: "relation", name: "user", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { type: "text", name: "email", max: 320 },
          { type: "text", name: "customer_name", max: 200 },
          { type: "text", name: "phone", max: 50 },
          { type: "text", name: "locale", max: 5 },
          { type: "json", name: "lines", maxSize: 200000 },
          { type: "json", name: "shipping_address", maxSize: 20000 },
          { type: "text", name: "shipping_method", max: 50 },
          { type: "number", name: "shipping_price", onlyInt: true },
          { type: "bool", name: "has_shipping_price" },
          { type: "json", name: "discount", maxSize: 2000 },
          { type: "text", name: "note", max: 2000 },
          { type: "relation", name: "order", collectionId: orders.id, maxSelect: 1, cascadeDelete: false },
          { type: "text", name: "checkout_session", max: 40 },
          { type: "text", name: "created_by", max: 40 },
          ...timestamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_draft_orders_number ON draft_orders (draft_number)"],
      }),
    );
  },
  (app) => {
    for (const name of ["draft_orders", "inventory_adjustments", "email_log"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const sessions = app.findCollectionByNameOrId("checkout_sessions");
    sessions.fields.removeByName("customer_note");
    app.save(sessions);
    // The payment fields stay text: going back to fixed choices would drop manual methods' ids.
  },
);
