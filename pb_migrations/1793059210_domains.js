/// <reference path="../pb_data/types.d.ts" />

// Settings → Domains (same table as 0005_domains in packages/backend-sql/migrations.ts).
// Locked to the server: only the superuser client reads and writes it, after a settings check.
migrate(
  (app) => {
    app.save(
      new Collection({
        type: "base",
        name: "domains",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "text", name: "hostname", required: true, max: 253 },
          // "store" or "admin": which app the domain serves.
          { type: "select", name: "target", required: true, maxSelect: 1, values: ["store", "admin"] },
          { type: "bool", name: "is_primary" },
          // pending (DNS not set) → verifying → active (SSL issued), or error.
          {
            type: "select",
            name: "status",
            required: true,
            maxSelect: 1,
            values: ["pending", "verifying", "active", "error"],
          },
          { type: "json", name: "dns_records" },
          { type: "text", name: "provider_ref", max: 200 },
          { type: "text", name: "last_error", max: 1000 },
          { type: "date", name: "last_checked_at" },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_domains_hostname ON domains (hostname)"],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("domains"));
  },
);
