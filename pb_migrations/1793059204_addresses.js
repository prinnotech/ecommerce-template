/// <reference path="../pb_data/types.d.ts" />

// Customer address book. Customers manage their own rows.
migrate(
  (app) => {
    const users_id = app.findCollectionByNameOrId("users").id;
    const is_owner = '@request.auth.id != "" && user = @request.auth.id';

    const addresses = new Collection({
      type: "base",
      name: "addresses",
      listRule: is_owner,
      viewRule: is_owner,
      createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
      // An address can't be moved to another user.
      updateRule: is_owner + " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
      deleteRule: is_owner,
      fields: [
        { type: "relation", name: "user", required: true, collectionId: users_id, maxSelect: 1, cascadeDelete: true },
        { type: "text", name: "full_name", required: true, max: 120 },
        { type: "text", name: "phone", max: 30 },
        { type: "text", name: "line1", required: true, max: 200 },
        { type: "text", name: "line2", max: 200 },
        { type: "text", name: "city", required: true, max: 100 },
        { type: "text", name: "region", max: 100 },
        { type: "text", name: "postal_code", max: 20 },
        { type: "text", name: "country", required: true, min: 2, max: 2, pattern: "^[A-Z]{2}$" },
        { type: "bool", name: "is_default" },
        { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_addresses_user ON addresses (user)"],
    });
    app.save(addresses);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("addresses"));
  },
);
