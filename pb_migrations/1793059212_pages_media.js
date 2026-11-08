/// <reference path="../pb_data/types.d.ts" />

// Custom pages (Online store → Pages) and the media library of the theme editor (same tables as
// 0007_pages_media in packages/backend-sql/migrations.ts). Both locked to the server: the store
// reads published pages and media URLs through the backend, with the superuser client.
migrate(
  (app) => {
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];

    app.save(
      new Collection({
        type: "base",
        name: "pages",
        ...locked,
        fields: [
          { type: "json", name: "title", maxSize: 20000 },
          { type: "text", name: "slug", required: true, max: 160, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          { type: "json", name: "sections", maxSize: 1000000 },
          { type: "json", name: "seo", maxSize: 20000 },
          { type: "bool", name: "is_published" },
          ...timestamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_pages_slug ON pages (slug)"],
      }),
    );

    app.save(
      new Collection({
        type: "base",
        name: "media",
        ...locked,
        fields: [
          {
            type: "file",
            name: "file",
            required: true,
            maxSelect: 1,
            maxSize: 10 * 1024 * 1024,
            mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
            // Files are served by URL from the store; the collection rules still lock the records.
            protected: false,
          },
          { type: "text", name: "name", max: 200 },
          { type: "number", name: "size", onlyInt: true, min: 0 },
          ...timestamps,
        ],
      }),
    );

    // The demo role can open the Pages screen (read-only).
    try {
      const demo = app.findFirstRecordByData("roles", "name", "demo");
      // JSON fields come back as raw bytes in the JS VM: read the text and parse it.
      const permissions = JSON.parse(demo.getString("permissions") || "[]");
      if (!permissions.includes("pages.view")) {
        demo.set("permissions", [...permissions, "pages.view"]);
        app.save(demo);
      }
    } catch {
      // No demo role on this deployment: nothing to update.
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("media"));
    app.delete(app.findCollectionByNameOrId("pages"));
  },
);
