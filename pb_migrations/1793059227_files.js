/// <reference path="../pb_data/types.d.ts" />

// Content → Files (same as 0022_files in packages/backend-sql/migrations.ts):
// - media: alt text and the file's MIME type.
// - the new files.view / files.edit permissions for the seeded staff role, files.view for the demo.
migrate(
  (app) => {
    const media = app.findCollectionByNameOrId("media");
    media.fields.add(new Field({ type: "text", name: "alt", max: 500 }));
    media.fields.add(new Field({ type: "text", name: "type", max: 50 }));
    app.save(media);

    const grants = { staff: ["files.view", "files.edit"], demo: ["files.view"] };
    for (const [name, added] of Object.entries(grants)) {
      try {
        const role = app.findFirstRecordByData("roles", "name", name);
        // JSON fields come back as raw bytes in the JS VM: read the text and parse it.
        const permissions = JSON.parse(role.getString("permissions") || "[]");
        const missing = added.filter((permission) => !permissions.includes(permission));
        if (missing.length > 0) {
          role.set("permissions", [...permissions, ...missing]);
          app.save(role);
        }
      } catch {
        // That role doesn't exist on this deployment: nothing to update.
      }
    }
  },
  (app) => {
    const media = app.findCollectionByNameOrId("media");
    for (const name of ["alt", "type"]) media.fields.removeByName(name);
    app.save(media);
  },
);
