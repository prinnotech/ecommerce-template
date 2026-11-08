/// <reference path="../pb_data/types.d.ts" />

// Products → Collections (same as 0014_collections in packages/backend-sql/migrations.ts).
// The store reads published collections with the public client; writes go through the admin.
migrate(
  (app) => {
    const products = app.findCollectionByNameOrId("products");
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];
    const collections = new Collection({
      type: "base",
      name: "collections",
      listRule: "is_published = true",
      viewRule: "is_published = true",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "json", name: "title", maxSize: 5000 },
        { type: "text", name: "slug", required: true, max: 120 },
        { type: "json", name: "description", maxSize: 50000 },
        { type: "text", name: "image_url", max: 1000 },
        { type: "select", name: "kind", required: true, maxSelect: 1, values: ["manual", "automatic"] },
        { type: "json", name: "rules", maxSize: 20000 },
        {
          type: "select",
          name: "sort",
          required: true,
          maxSelect: 1,
          values: ["manual", "newest", "price_asc", "price_desc", "title"],
        },
        { type: "bool", name: "is_published" },
        { type: "json", name: "seo", maxSize: 20000 },
        { type: "number", name: "sort_order", onlyInt: true },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_collections_slug ON collections (slug)"],
    });
    app.save(collections);

    app.save(
      new Collection({
        type: "base",
        name: "collection_products",
        listRule: "collection.is_published = true",
        viewRule: "collection.is_published = true",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            type: "relation",
            name: "collection",
            required: true,
            collectionId: collections.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            type: "relation",
            name: "product",
            required: true,
            collectionId: products.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { type: "number", name: "position", onlyInt: true },
          ...timestamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_collection_products_unique ON collection_products (collection, product)"],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("collection_products"));
    app.delete(app.findCollectionByNameOrId("collections"));
  },
);
