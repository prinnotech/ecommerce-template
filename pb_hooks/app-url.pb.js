/// <reference path="../pb_data/types.d.ts" />

// Keeps PocketBase's app URL (used as {APP_URL} in auth emails) in sync with the
// PB_APP_URL env var on every boot, so each deploy only has to set the env var.
onBootstrap((e) => {
  e.next();

  const app_url = $os.getenv("PB_APP_URL").replace(/\/$/, "");
  if (!app_url) return;

  const settings = e.app.settings();
  if (settings.meta.appURL === app_url) return;
  settings.meta.appURL = app_url;
  e.app.save(settings);
});
