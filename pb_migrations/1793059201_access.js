/// <reference path="../pb_data/types.d.ts" />

// Roles, team members and the activity log (style guide §11).
// Signing up never creates a team_members row: staff are added by an admin.
migrate(
  (app) => {
    const users_id = app.findCollectionByNameOrId("users").id;
    const timestamps = [
      { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
    ];
    // The auth guard matters: for anonymous requests PocketBase compares "" with the
    // empty join and would otherwise let visitors through.
    const is_signed_in = '@request.auth.id != ""';
    const is_team_member = is_signed_in + " && @collection.team_members.user ?= @request.auth.id";

    const roles = new Collection({
      type: "base",
      name: "roles",
      // Set after team_members exists, since the rule references it.
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "text", name: "name", required: true, max: 50, pattern: "^[a-z0-9_-]+$" },
        { type: "text", name: "description", max: 300 },
        { type: "json", name: "permissions" },
        { type: "bool", name: "is_system" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_roles_name ON roles (name)"],
    });
    app.save(roles);

    const team_members = new Collection({
      type: "base",
      name: "team_members",
      listRule: is_signed_in + " && user = @request.auth.id",
      viewRule: is_signed_in + " && user = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "relation", name: "user", required: true, collectionId: users_id, maxSelect: 1, cascadeDelete: true },
        { type: "json", name: "roles" },
        { type: "bool", name: "is_admin" },
        { type: "bool", name: "is_active" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_team_members_user ON team_members (user)"],
    });
    app.save(team_members);

    roles.listRule = is_team_member;
    roles.viewRule = is_team_member;
    app.save(roles);

    const activity_log = new Collection({
      type: "base",
      name: "activity_log",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "relation", name: "actor", collectionId: users_id, maxSelect: 1, cascadeDelete: false },
        { type: "text", name: "action", required: true, max: 200 },
        { type: "text", name: "target_type", max: 100 },
        { type: "text", name: "target_id", max: 100 },
        { type: "json", name: "details" },
        { type: "bool", name: "is_denied" },
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_activity_log_created_at ON activity_log (created_at)"],
    });
    app.save(activity_log);

    const seed_roles = [
      {
        name: "admin",
        description: "Full access to the store.",
        permissions: ["isSuperAdmin"],
      },
      {
        name: "staff",
        description: "Day-to-day store work: products and orders.",
        permissions: [
          "dashboard.view",
          "products.view",
          "products.edit",
          "categories.edit",
          "orders.view",
          "orders.edit",
          "customers.view",
          "messages.view",
        ],
      },
    ];
    for (const role of seed_roles) {
      const record = new Record(roles);
      record.set("name", role.name);
      record.set("description", role.description);
      record.set("permissions", role.permissions);
      record.set("is_system", true);
      app.save(record);
    }
  },
  (app) => {
    for (const name of ["activity_log", "team_members", "roles"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
