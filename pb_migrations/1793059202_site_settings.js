/// <reference path="../pb_data/types.d.ts" />

// Key/value site settings (style guide §12). No rows are seeded: missing keys
// fall back to the defaults in lib/site-settings.ts.
migrate(
  (app) => {
    const users_id = app.findCollectionByNameOrId("users").id;

    const site_settings = new Collection({
      type: "base",
      name: "site_settings",
      listRule: "is_public = true",
      viewRule: "is_public = true",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "text", name: "key", required: true, max: 100, pattern: "^[A-Z0-9_]+$" },
        { type: "text", name: "category", max: 50 },
        { type: "json", name: "value" },
        { type: "text", name: "description", max: 500 },
        { type: "bool", name: "is_public" },
        { type: "relation", name: "updated_by", collectionId: users_id, maxSelect: 1, cascadeDelete: false },
        { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_site_settings_key ON site_settings (key)"],
    });
    app.save(site_settings);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("site_settings"));
  },
);
