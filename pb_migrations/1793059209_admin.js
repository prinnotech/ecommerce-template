/// <reference path="../pb_data/types.d.ts" />

// Phase 4 admin (same changes as 0004_admin in packages/backend-sql/migrations.ts): staff language,
// read-only roles (the demo), image colors, customer notes and marketing consent, saved list views.
migrate(
  (app) => {
    // Defined inside the callback: PocketBase may run it apart from the file's top-level scope.
    // findFirstRecordByData throws when nothing matches.
    const findRole = (name) => {
      try {
        return app.findFirstRecordByData("roles", "name", name);
      } catch {
        return null;
      }
    };
    const users = app.findCollectionByNameOrId("users");
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];

    // The admin language each staff member picked ("" = browser language).
    const team_members = app.findCollectionByNameOrId("team_members");
    team_members.fields.add(new Field({ type: "text", name: "locale", max: 5 }));
    app.save(team_members);

    // Read-only roles see every screen they have a .view permission for and can't change anything.
    const roles = app.findCollectionByNameOrId("roles");
    roles.fields.add(new Field({ type: "bool", name: "is_read_only" }));
    app.save(roles);

    // Image file name → color (option value) it shows. Files have no records of their own here.
    const products = app.findCollectionByNameOrId("products");
    products.fields.add(new Field({ type: "json", name: "image_colors" }));
    app.save(products);

    // The customer's own choice, so it lives on their profile (they may update it).
    users.fields.add(new Field({ type: "bool", name: "accepts_marketing" }));
    app.save(users);

    // Staff-only notes about a customer. Not on `users`: customers can update their own record.
    // customer_key = the user id, or "email:<address>" for a guest.
    app.save(
      new Collection({
        type: "base",
        name: "customer_notes",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "text", name: "customer_key", required: true, max: 320 },
          { type: "text", name: "note", max: 5000 },
          { type: "relation", name: "updated_by", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          ...timestamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_customer_notes_key ON customer_notes (customer_key)"],
      }),
    );

    // Each staff member's own saved filters for an index table (resource = "orders", "products"…).
    app.save(
      new Collection({
        type: "base",
        name: "saved_views",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { type: "text", name: "resource", required: true, max: 50 },
          { type: "text", name: "name", required: true, max: 60 },
          { type: "json", name: "filters" },
          ...timestamps,
        ],
        indexes: ["CREATE INDEX idx_saved_views_user_resource ON saved_views (user, resource)"],
      }),
    );

    // Logo and favicon files (one record per kind). Public, since the store shows them; written only
    // by the server after a settings.edit check.
    app.save(
      new Collection({
        type: "base",
        name: "site_assets",
        listRule: "",
        viewRule: "",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { type: "text", name: "kind", required: true, max: 20 },
          {
            type: "file",
            name: "file",
            maxSelect: 1,
            maxSize: 2 * 1024 * 1024,
            mimeTypes: [
              "image/png",
              "image/jpeg",
              "image/webp",
              "image/svg+xml",
              "image/x-icon",
              "image/vnd.microsoft.icon",
            ],
          },
          ...timestamps,
        ],
        indexes: ["CREATE UNIQUE INDEX idx_site_assets_kind ON site_assets (kind)"],
      }),
    );

    // Categories got their own view permission (the demo can open the page without editing).
    const staff = findRole("staff");
    if (staff) {
      // JSON fields come back as raw bytes in the JS VM: read the text and parse it.
      const permissions = JSON.parse(staff.getString("permissions") || "[]");
      if (!permissions.includes("categories.view")) {
        staff.set("permissions", [...permissions, "categories.view"]);
        app.save(staff);
      }
    }

    const demo = new Record(roles);
    demo.set("name", "demo");
    demo.set("description", "Public demo: sees everything, changes nothing.");
    demo.set("permissions", [
      "dashboard.view",
      "products.view",
      "categories.view",
      "orders.view",
      "customers.view",
      "messages.view",
      "settings.view",
      "users.view",
      "roles.view",
      "audit.view",
    ]);
    demo.set("is_system", true);
    demo.set("is_read_only", true);
    app.save(demo);
  },
  (app) => {
    // Defined inside the callback: PocketBase may run it apart from the file's top-level scope.
    // findFirstRecordByData throws when nothing matches.
    const findRole = (name) => {
      try {
        return app.findFirstRecordByData("roles", "name", name);
      } catch {
        return null;
      }
    };
    const demo = findRole("demo");
    if (demo) app.delete(demo);
    for (const name of ["site_assets", "saved_views", "customer_notes"]) app.delete(app.findCollectionByNameOrId(name));
    const removals = [
      ["users", "accepts_marketing"],
      ["products", "image_colors"],
      ["roles", "is_read_only"],
      ["team_members", "locale"],
    ];
    for (const [collection_name, field_name] of removals) {
      const collection = app.findCollectionByNameOrId(collection_name);
      collection.fields.removeByName(field_name);
      app.save(collection);
    }
  },
);
