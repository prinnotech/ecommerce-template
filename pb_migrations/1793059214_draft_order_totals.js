/// <reference path="../pb_data/types.d.ts" />

// The drafts list shows each draft's total, saved when the draft is.
migrate(
  (app) => {
    const drafts = app.findCollectionByNameOrId("draft_orders");
    drafts.fields.add(new NumberField({ name: "total", onlyInt: true, min: 0 }));
    drafts.fields.add(new TextField({ name: "currency", max: 3 }));
    app.save(drafts);
  },
  (app) => {
    const drafts = app.findCollectionByNameOrId("draft_orders");
    drafts.fields.removeByName("total");
    drafts.fields.removeByName("currency");
    app.save(drafts);
  },
);
