/// <reference path="../pb_data/types.d.ts" />

// Marketing → Discounts (same changes as 0010_discounts in packages/backend-sql/migrations.ts):
// free shipping, limits to products or categories, once per customer, soft delete.
migrate(
  (app) => {
    const discounts = app.findCollectionByNameOrId("discount_codes");
    discounts.fields.getByName("type").values = ["percent", "fixed", "free_shipping"];
    discounts.fields.add(new TextField({ name: "title", max: 120 }));
    discounts.fields.add(new JSONField({ name: "applies_to", maxSize: 20000 }));
    discounts.fields.add(new BoolField({ name: "once_per_customer" }));
    discounts.fields.add(new DateField({ name: "deleted_at" }));
    app.save(discounts);

    const orders = app.findCollectionByNameOrId("orders");
    orders.indexes.push("CREATE INDEX idx_orders_discount_email ON orders (discount_code, email)");
    app.save(orders);
  },
  (app) => {
    const orders = app.findCollectionByNameOrId("orders");
    orders.indexes = orders.indexes.filter((index) => !index.includes("idx_orders_discount_email"));
    app.save(orders);

    const discounts = app.findCollectionByNameOrId("discount_codes");
    for (const name of ["title", "applies_to", "once_per_customer", "deleted_at"]) discounts.fields.removeByName(name);
    discounts.fields.getByName("type").values = ["percent", "fixed"];
    app.save(discounts);
  },
);
