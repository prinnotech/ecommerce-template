/// <reference path="../pb_data/types.d.ts" />

// Automatic discounts and Buy X get Y (same as 0020_discounts_v2 in packages/backend-sql/migrations.ts):
// - discount_codes: method (code | automatic; empty = code), the buy_x_get_y deal, combines_with.
// - checkout_sessions and orders: applied_discounts, one entry per discount used.
migrate(
  (app) => {
    const discounts = app.findCollectionByNameOrId("discount_codes");
    discounts.fields.getByName("type").values = ["percent", "fixed", "free_shipping", "buy_x_get_y"];
    discounts.fields.add(new Field({ type: "text", name: "method", max: 20 }));
    discounts.fields.add(new Field({ type: "json", name: "buy_x_get_y", maxSize: 50000 }));
    discounts.fields.add(new Field({ type: "json", name: "combines_with", maxSize: 1000 }));
    app.save(discounts);

    for (const name of ["checkout_sessions", "orders"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.add(new Field({ type: "json", name: "applied_discounts", maxSize: 20000 }));
      app.save(collection);
    }
  },
  (app) => {
    for (const name of ["checkout_sessions", "orders"]) {
      const collection = app.findCollectionByNameOrId(name);
      collection.fields.removeByName("applied_discounts");
      app.save(collection);
    }
    const discounts = app.findCollectionByNameOrId("discount_codes");
    for (const name of ["method", "buy_x_get_y", "combines_with"]) discounts.fields.removeByName(name);
    discounts.fields.getByName("type").values = ["percent", "fixed", "free_shipping"];
    app.save(discounts);
  },
);
