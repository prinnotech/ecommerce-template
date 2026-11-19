/// <reference path="../pb_data/types.d.ts" />

// Segments and email campaigns (same as 0025_campaigns in packages/backend-sql/migrations.ts):
// - customer_segments: saved customer filters (rules as JSON).
// - email_campaigns: subject and body per language, the segment, status and counts.
// - campaign_deliveries: one row per recipient (pending → sent/failed), so sending resumes where
//   it stopped. All locked: only the server reads and writes them.
// - campaigns.view / campaigns.edit for the seeded staff role, campaigns.view for the demo.
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
        name: "customer_segments",
        ...locked,
        fields: [
          { type: "text", name: "name", required: true, max: 80 },
          { type: "json", name: "rules", maxSize: 20000 },
          ...timestamps,
        ],
      }),
    );
    const campaigns = new Collection({
      type: "base",
      name: "email_campaigns",
      ...locked,
      fields: [
        { type: "text", name: "name", required: true, max: 120 },
        { type: "text", name: "segment_id", max: 40 },
        { type: "json", name: "subject", maxSize: 20000 },
        { type: "json", name: "body", maxSize: 500000 },
        { type: "text", name: "status", required: true, max: 20 },
        { type: "number", name: "recipient_count", onlyInt: true, min: 0 },
        { type: "number", name: "sent_count", onlyInt: true, min: 0 },
        { type: "number", name: "failed_count", onlyInt: true, min: 0 },
        { type: "date", name: "sent_at" },
        ...timestamps,
      ],
      indexes: ["CREATE INDEX idx_email_campaigns_status ON email_campaigns (status)"],
    });
    app.save(campaigns);
    app.save(
      new Collection({
        type: "base",
        name: "campaign_deliveries",
        ...locked,
        fields: [
          {
            type: "relation",
            name: "campaign",
            required: true,
            collectionId: campaigns.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { type: "text", name: "user_id", max: 40 },
          { type: "text", name: "email", required: true, max: 320 },
          { type: "text", name: "name", max: 200 },
          { type: "text", name: "locale", max: 20 },
          { type: "text", name: "status", required: true, max: 20 },
          { type: "text", name: "error", max: 500 },
          ...timestamps,
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_campaign_deliveries_email ON campaign_deliveries (campaign, email)",
          "CREATE INDEX idx_campaign_deliveries_status ON campaign_deliveries (campaign, status)",
        ],
      }),
    );

    const grants = { staff: ["campaigns.view", "campaigns.edit"], demo: ["campaigns.view"] };
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
    for (const name of ["campaign_deliveries", "email_campaigns", "customer_segments"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
