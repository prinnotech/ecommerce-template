/// <reference path="../pb_data/types.d.ts" />

// Content → Blog posts (same as 0023_blog in packages/backend-sql/migrations.ts):
// - blog_posts: locked; the store reads published posts through the server, like pages.
// - blog.view / blog.edit for the seeded staff role, blog.view for the demo.
migrate(
  (app) => {
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    app.save(
      new Collection({
        type: "base",
        name: "blog_posts",
        ...locked,
        fields: [
          { type: "json", name: "title", maxSize: 20000 },
          { type: "text", name: "slug", required: true, max: 160 },
          { type: "json", name: "excerpt", maxSize: 50000 },
          { type: "json", name: "body", maxSize: 2000000 },
          { type: "text", name: "cover_url", max: 2000 },
          { type: "json", name: "cover_alt", maxSize: 10000 },
          { type: "json", name: "tags", maxSize: 5000 },
          { type: "text", name: "author", max: 80 },
          { type: "json", name: "seo", maxSize: 20000 },
          { type: "bool", name: "is_published" },
          { type: "date", name: "published_at" },
          { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
          { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_blog_posts_slug ON blog_posts (slug)",
          "CREATE INDEX idx_blog_posts_published ON blog_posts (is_published, published_at)",
        ],
      }),
    );

    const grants = { staff: ["blog.view", "blog.edit"], demo: ["blog.view"] };
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
    app.delete(app.findCollectionByNameOrId("blog_posts"));
  },
);
