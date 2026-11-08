/// <reference path="../pb_data/types.d.ts" />

// Staff API keys for the MCP server (same as 0018_api_keys in packages/backend-sql/migrations.ts).
// Only the SHA-256 hash is stored. Server only.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    app.save(
      new Collection({
        type: "base",
        name: "api_keys",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { type: "text", name: "name", required: true, max: 80 },
          { type: "text", name: "key_prefix", required: true, max: 20 },
          { type: "text", name: "key_hash", required: true, max: 64 },
          { type: "date", name: "last_used_at" },
          { type: "date", name: "revoked_at" },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (key_hash)"],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("api_keys"));
  },
);
