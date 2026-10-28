/// <reference path="../pb_data/types.d.ts" />

// Messages from the contact page. Created by a server action, read in the dashboard.
migrate(
  (app) => {
    const contact_messages = new Collection({
      type: "base",
      name: "contact_messages",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "text", name: "name", required: true, max: 120 },
        { type: "email", name: "email", required: true },
        { type: "text", name: "phone", max: 30 },
        { type: "text", name: "subject", max: 200 },
        { type: "text", name: "message", required: true, max: 5000 },
        { type: "select", name: "status", required: true, maxSelect: 1, values: ["new", "read", "archived"] },
        { type: "autodate", name: "created_at", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated_at", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_contact_messages_status ON contact_messages (status)"],
    });
    app.save(contact_messages);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("contact_messages"));
  },
);
