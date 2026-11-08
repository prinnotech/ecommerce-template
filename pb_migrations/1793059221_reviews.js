/// <reference path="../pb_data/types.d.ts" />

// Product reviews (same as 0016_reviews in packages/backend-sql/migrations.ts). Server only:
// the store reads approved reviews through the backend.
migrate(
  (app) => {
    const products = app.findCollectionByNameOrId("products");
    const users = app.findCollectionByNameOrId("users");
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    app.save(
      new Collection({
        type: "base",
        name: "reviews",
        ...locked,
        fields: [
          { type: "relation", name: "product", required: true, collectionId: products.id, maxSelect: 1, cascadeDelete: true },
          { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { type: "text", name: "email", max: 320 },
          { type: "number", name: "rating", onlyInt: true, min: 1, max: 5 },
          { type: "text", name: "title", max: 120 },
          { type: "text", name: "body", required: true, max: 4000 },
          { type: "text", name: "author_name", required: true, max: 80 },
          { type: "text", name: "locale", max: 5 },
          { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "approved", "hidden"] },
          { type: "text", name: "reply", max: 2000 },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_reviews_one_per_customer ON reviews (product, user)",
          "CREATE INDEX idx_reviews_product_status ON reviews (product, status)",
        ],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("reviews"));
  },
);
