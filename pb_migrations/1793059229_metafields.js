/// <reference path="../pb_data/types.d.ts" />

// Settings → Custom data (same as 0024_metafields in packages/backend-sql/migrations.ts):
// - metafield_definitions: the extra fields for products, collections and customers.
// - metafield_values: one JSON object (data) of values per record (owner + its id or customer key).
// Both locked: the admin and the store read them through the server.
migrate(
  (app) => {
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    app.save(
      new Collection({
        type: "base",
        name: "metafield_definitions",
        ...locked,
        fields: [
          { type: "text", name: "owner", required: true, max: 20 },
          { type: "text", name: "key", required: true, max: 40 },
          { type: "json", name: "name", maxSize: 5000 },
          { type: "json", name: "description", maxSize: 10000 },
          { type: "text", name: "type", required: true, max: 20 },
          { type: "bool", name: "is_storefront" },
          { type: "number", name: "position", onlyInt: true },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_metafield_definitions_key ON metafield_definitions (owner, `key`)"],
      }),
    );
    app.save(
      new Collection({
        type: "base",
        name: "metafield_values",
        ...locked,
        fields: [
          { type: "text", name: "owner", required: true, max: 20 },
          { type: "text", name: "owner_key", required: true, max: 60 },
          { type: "json", name: "data", maxSize: 200000 },
          { type: "text", name: "updated_by", max: 40 },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_metafield_values_owner ON metafield_values (owner, owner_key)"],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("metafield_values"));
    app.delete(app.findCollectionByNameOrId("metafield_definitions"));
  },
);
