/// <reference path="../pb_data/types.d.ts" />

// Online store → Themes (same table as 0006_themes in packages/backend-sql/migrations.ts).
// Locked to the server: the store reads the live theme and the admin writes through actions,
// both with the superuser client.
migrate(
  (app) => {
    app.save(
      new Collection({
        type: "base",
        name: "themes",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "text", name: "name", required: true, max: 60 },
          // The template it started from (packages/core/themes).
          { type: "text", name: "template", required: true, max: 40 },
          { type: "json", name: "draft", maxSize: 1000000 },
          // Empty until the first publish.
          { type: "json", name: "published", maxSize: 1000000 },
          // Last published versions, newest first: [{ published_at, data }].
          { type: "json", name: "history", maxSize: 5000000 },
          { type: "bool", name: "is_live" },
          { type: "date", name: "published_at" },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
      }),
    );

    // The demo role can open the theme screens (read-only, like every other screen).
    try {
      const demo = app.findFirstRecordByData("roles", "name", "demo");
      // JSON fields come back as raw bytes in the JS VM: read the text and parse it.
      const permissions = JSON.parse(demo.getString("permissions") || "[]");
      if (!permissions.includes("themes.view")) {
        demo.set("permissions", [...permissions, "themes.view"]);
        app.save(demo);
      }
    } catch {
      // No demo role on this deployment: nothing to update.
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("themes"));
  },
);
