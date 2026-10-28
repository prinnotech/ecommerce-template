/// <reference path="../pb_data/types.d.ts" />

// Catalog: categories, products and their variants. Localized text (name,
// title, description) is stored as { en, es, it } JSON. Prices are integer cents.
migrate(
  (app) => {
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];
    const slug_pattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
    const image_types = ["image/jpeg", "image/png", "image/webp", "image/avif"];

    const categories = new Collection({
      type: "base",
      name: "categories",
      listRule: "is_active = true",
      viewRule: "is_active = true",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "json", name: "name", required: true },
        { type: "text", name: "slug", required: true, max: 120, pattern: slug_pattern },
        { type: "json", name: "description" },
        {
          type: "file",
          name: "image",
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: image_types,
          thumbs: ["400x400", "800x0"],
        },
        { type: "number", name: "sort_order", onlyInt: true },
        { type: "bool", name: "is_active" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_categories_slug ON categories (slug)"],
    });
    app.save(categories);
    // Self-relation needs the collection id, so it is added after the first save.
    categories.fields.add(
      new Field({ type: "relation", name: "parent", collectionId: categories.id, maxSelect: 1, cascadeDelete: false }),
    );
    app.save(categories);

    const products = new Collection({
      type: "base",
      name: "products",
      listRule: 'status = "active" && deleted_at = ""',
      viewRule: 'status = "active" && deleted_at = ""',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "json", name: "title", required: true },
        { type: "text", name: "slug", required: true, max: 160, pattern: slug_pattern },
        { type: "json", name: "description" },
        { type: "relation", name: "category", collectionId: categories.id, maxSelect: 1, cascadeDelete: false },
        {
          type: "file",
          name: "images",
          maxSelect: 10,
          maxSize: 10485760,
          mimeTypes: image_types,
          thumbs: ["100x100", "400x500", "800x1000"],
        },
        { type: "number", name: "price", onlyInt: true, min: 0 },
        { type: "number", name: "compare_at_price", onlyInt: true, min: 0 },
        { type: "select", name: "status", required: true, maxSelect: 1, values: ["draft", "active", "archived"] },
        { type: "bool", name: "is_featured" },
        { type: "json", name: "tags" },
        { type: "date", name: "deleted_at" },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_products_slug ON products (slug)",
        "CREATE INDEX idx_products_status ON products (status)",
        "CREATE INDEX idx_products_category ON products (category)",
      ],
    });
    app.save(products);

    const product_variants = new Collection({
      type: "base",
      name: "product_variants",
      listRule: 'is_active = true && product.status = "active" && product.deleted_at = ""',
      viewRule: 'is_active = true && product.status = "active" && product.deleted_at = ""',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          type: "relation",
          name: "product",
          required: true,
          collectionId: products.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { type: "text", name: "size", max: 30 },
        { type: "text", name: "color", max: 50 },
        { type: "text", name: "color_hex", max: 7, pattern: "^#[0-9a-fA-F]{6}$" },
        { type: "text", name: "sku", max: 64 },
        // Empty means "use the product price".
        { type: "number", name: "price_override", onlyInt: true, min: 0 },
        { type: "number", name: "stock", onlyInt: true, min: 0 },
        { type: "bool", name: "is_active" },
        { type: "number", name: "sort_order", onlyInt: true },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_product_variants_sku ON product_variants (sku) WHERE sku != ''",
        "CREATE INDEX idx_product_variants_product ON product_variants (product)",
      ],
    });
    app.save(product_variants);
  },
  (app) => {
    for (const name of ["product_variants", "products", "categories"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
