/// <reference path="../pb_data/types.d.ts" />

// Enables the batch API (atomic order placement) and adapts the built-in users collection.
migrate(
  (app) => {
    const settings = app.settings();
    settings.batch.enabled = true;
    settings.batch.maxRequests = 100;
    settings.batch.timeout = 10;
    app.save(settings);

    const users = app.findCollectionByNameOrId("users");
    // Keep timestamps consistent with every other collection.
    users.fields.getByName("created").name = "created_at";
    users.fields.getByName("updated").name = "updated_at";
    users.fields.add(new Field({ type: "text", name: "phone", max: 30 }));
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.createRule = "";
    users.updateRule = "id = @request.auth.id";
    // Account deletion goes through an action so orders keep their history.
    users.deleteRule = null;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("phone");
    users.fields.getByName("created_at").name = "created";
    users.fields.getByName("updated_at").name = "updated";
    users.deleteRule = "id = @request.auth.id";
    app.save(users);

    const settings = app.settings();
    settings.batch.enabled = false;
    app.save(settings);
  },
);
