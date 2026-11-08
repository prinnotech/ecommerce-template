/// <reference path="../pb_data/types.d.ts" />

// Partial refunds (same as 0013_refunds in packages/backend-sql/migrations.ts).
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId("orders");
    orders.fields.getByName("payment_status").values = ["unpaid", "paid", "failed", "partially_refunded", "refunded"];
    orders.fields.add(new NumberField({ name: "refunded_total", onlyInt: true, min: 0 }));
    app.save(orders);

    const events = app.findCollectionByNameOrId("order_events");
    events.fields.getByName("type").values = [
      "created",
      "status_changed",
      "payment_status_changed",
      "note",
      "shipped",
      "email_sent",
      "refund",
    ];
    app.save(events);

    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    app.save(
      new Collection({
        type: "base",
        name: "refunds",
        ...locked,
        fields: [
          {
            type: "relation",
            name: "order",
            required: true,
            collectionId: orders.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { type: "number", name: "amount", onlyInt: true, min: 1 },
          { type: "json", name: "lines", maxSize: 50000 },
          { type: "text", name: "reason", max: 500 },
          { type: "bool", name: "restocked" },
          { type: "text", name: "provider_ref", max: 200 },
          { type: "text", name: "actor_id", max: 40 },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE INDEX idx_refunds_order ON refunds (order)"],
      }),
    );

    // Orders already refunded in full count as refunded_total = total.
    for (const order of app.findRecordsByFilter("orders", 'payment_status = "refunded"')) {
      order.set("refunded_total", order.get("total"));
      app.saveNoValidate(order);
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("refunds"));
    const orders = app.findCollectionByNameOrId("orders");
    orders.fields.removeByName("refunded_total");
    app.save(orders);
    // payment_status and event types keep their new values: rows may already use them.
  },
);
