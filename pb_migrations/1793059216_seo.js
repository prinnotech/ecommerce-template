/// <reference path="../pb_data/types.d.ts" />

// Search engine listing for products and categories (same as 0011_seo in packages/backend-sql/migrations.ts).
migrate(
  (app) => {
    for (const name of ["products", "categories"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.add(new JSONField({ name: "seo", maxSize: 20000 }));
      app.save(collection);
    }
  },
  (app) => {
    for (const name of ["products", "categories"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.removeByName("seo");
      app.save(collection);
    }
  },
);
