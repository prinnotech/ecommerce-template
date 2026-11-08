/// <reference path="../pb_data/types.d.ts" />

// Wishlist (same as 0017_wishlist in packages/backend-sql/migrations.ts). Server only.
migrate(
  (app) => {
    const products = app.findCollectionByNameOrId("products");
    const users = app.findCollectionByNameOrId("users");
    app.save(
      new Collection({
        type: "base",
        name: "wishlist_items",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { type: "relation", name: "product", required: true, collectionId: products.id, maxSelect: 1, cascadeDelete: true },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_wishlist_unique ON wishlist_items (user, product)"],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("wishlist_items"));
  },
);
