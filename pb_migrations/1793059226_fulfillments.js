/// <reference path="../pb_data/types.d.ts" />

// Packages (same as 0021_fulfillments in packages/backend-sql/migrations.ts):
// - fulfillments: one row per package (lines and quantities, carrier, tracking). Customers can read
//   the packages of their own orders; writes go through the server.
// - order_events.type: "fulfilled" and "fulfillment_cancelled".
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId("orders");
    const own_order = '@request.auth.id != "" && order.user = @request.auth.id';
    app.save(
      new Collection({
        type: "base",
        name: "fulfillments",
        listRule: own_order,
        viewRule: own_order,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "order",
            required: true,
            collectionId: orders.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { type: "text", name: "status", required: true, max: 20 },
          { type: "json", name: "lines", maxSize: 50000 },
          { type: "text", name: "carrier", max: 100 },
          { type: "text", name: "tracking_number", max: 100 },
          { type: "text", name: "tracking_url", max: 2000 },
          { type: "text", name: "actor_id", max: 40 },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE INDEX idx_fulfillments_order ON fulfillments (`order`)"],
      }),
    );

    const events = app.findCollectionByNameOrId("order_events");
    events.fields.getByName("type").values = [
      "created",
      "status_changed",
      "payment_status_changed",
      "note",
      "shipped",
      "email_sent",
      "refund",
      "fulfilled",
      "fulfillment_cancelled",
    ];
    app.save(events);
  },
  (app) => {
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
    app.delete(app.findCollectionByNameOrId("fulfillments"));
  },
);
