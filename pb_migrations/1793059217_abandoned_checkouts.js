/// <reference path="../pb_data/types.d.ts" />

// Abandoned checkouts (same as 0012_abandoned_checkouts in packages/backend-sql/migrations.ts).
migrate(
  (app) => {
    const sessions = app.findCollectionByNameOrId("checkout_sessions");
    sessions.fields.add(new DateField({ name: "contact_at" }));
    sessions.fields.add(new DateField({ name: "recovery_sent_at" }));
    sessions.indexes.push("CREATE INDEX idx_checkout_sessions_contact_at ON checkout_sessions (contact_at)");
    app.save(sessions);
  },
  (app) => {
    const sessions = app.findCollectionByNameOrId("checkout_sessions");
    sessions.indexes = sessions.indexes.filter((index) => !index.includes("idx_checkout_sessions_contact_at"));
    sessions.fields.removeByName("contact_at");
    sessions.fields.removeByName("recovery_sent_at");
    app.save(sessions);
  },
);
