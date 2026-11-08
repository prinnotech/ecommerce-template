/// <reference path="../pb_data/types.d.ts" />

// Gift cards (same as 0015_gift_cards in packages/backend-sql/migrations.ts). Server only.
migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId("orders");
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];
    const cards = new Collection({
      type: "base",
      name: "gift_cards",
      ...locked,
      fields: [
        { type: "text", name: "code", required: true, max: 40 },
        { type: "number", name: "initial_value", onlyInt: true, min: 1 },
        // min 0: a spend larger than the balance fails the whole batch.
        { type: "number", name: "balance", onlyInt: true, min: 0 },
        { type: "text", name: "currency", max: 3 },
        { type: "date", name: "expires_at" },
        { type: "bool", name: "is_active" },
        { type: "text", name: "customer_email", max: 320 },
        { type: "text", name: "note", max: 500 },
        { type: "relation", name: "order", collectionId: orders.id, maxSelect: 1, cascadeDelete: false },
        { type: "text", name: "created_by", max: 40 },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_gift_cards_code ON gift_cards (code)"],
    });
    app.save(cards);
    app.save(
      new Collection({
        type: "base",
        name: "gift_card_transactions",
        ...locked,
        fields: [
          {
            type: "relation",
            name: "gift_card",
            required: true,
            collectionId: cards.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { type: "number", name: "amount", onlyInt: true },
          { type: "text", name: "order_id", max: 40 },
          { type: "text", name: "note", max: 500 },
          ...timestamps,
        ],
        indexes: ["CREATE INDEX idx_gift_card_tx_card ON gift_card_transactions (gift_card)"],
      }),
    );

    const products = app.findCollectionByNameOrId("products");
    products.fields.add(new BoolField({ name: "is_gift_card" }));
    app.save(products);
    orders.fields.add(new NumberField({ name: "gift_card_total", onlyInt: true, min: 0 }));
    app.save(orders);
    const sessions = app.findCollectionByNameOrId("checkout_sessions");
    sessions.fields.add(new TextField({ name: "gift_card_id", max: 40 }));
    sessions.fields.add(new NumberField({ name: "gift_card_amount", onlyInt: true, min: 0 }));
    app.save(sessions);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("gift_card_transactions"));
    app.delete(app.findCollectionByNameOrId("gift_cards"));
    for (const [name, fields] of [
      ["products", ["is_gift_card"]],
      ["orders", ["gift_card_total"]],
      ["checkout_sessions", ["gift_card_id", "gift_card_amount"]],
    ]) {
      const collection = app.findCollectionByNameOrId(name);
      for (const field of fields) collection.fields.removeByName(field);
      app.save(collection);
    }
  },
);
