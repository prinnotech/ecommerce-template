/// <reference path="../pb_data/types.d.ts" />

// SMS and WhatsApp (same as 0019_messages in packages/backend-sql/migrations.ts):
// - message_log: every message sent or refused. Locked, server only.
// - sms_opt_in on checkout_sessions and orders: the customer's choice at checkout.
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId("orders");
    app.save(
      new Collection({
        type: "base",
        name: "message_log",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "text", name: "channel", required: true, max: 20 },
          { type: "text", name: "event", required: true, max: 60 },
          { type: "text", name: "recipient", required: true, max: 40 },
          { type: "text", name: "body", max: 2000 },
          { type: "text", name: "status", required: true, max: 20 },
          { type: "text", name: "error", max: 2000 },
          { type: "text", name: "provider_ref", max: 80 },
          { type: "relation", name: "order", collectionId: orders.id, maxSelect: 1, cascadeDelete: false },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_message_log_created_at ON message_log (created_at)",
          "CREATE INDEX idx_message_log_order ON message_log (`order`)",
        ],
      }),
    );

    for (const name of ["checkout_sessions", "orders"]) {
      const collection = app.findCollectionByNameOrId(name);
      // bool fields are never required (required means "must be true").
      collection.fields.add(new Field({ type: "bool", name: "sms_opt_in" }));
      app.save(collection);
    }
  },
  (app) => {
    for (const name of ["checkout_sessions", "orders"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.removeByName("sms_opt_in");
      app.save(collection);
    }
    app.delete(app.findCollectionByNameOrId("message_log"));
  },
);
