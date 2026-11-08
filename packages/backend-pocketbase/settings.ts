import "server-only";

import type { SettingsBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { getFileUrl } from "@repo/backend-pocketbase/files";

// site_settings is read with the superuser client: non-public keys are read too, and every
// value is validated per key by the site-settings contract before use.
async function findRow(key: string) {
  const pb = await createAdminPocketBase();
  const row = await pb
    .collection("site_settings")
    .getFirstListItem(pb.filter("key = {:key}", { key }), { fields: "id,key,value,updated_at" })
    .catch(() => null);
  return { pb, row };
}

export const settings: SettingsBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("site_settings").getFullList({ fields: "key,value,updated_at" });
    return rows.map((row) => ({ key: row.key, value: row.value, updated_at: row.updated_at }));
  },

  async get(key) {
    const { row } = await findRow(key);
    return row ? { key: row.key, value: row.value, updated_at: row.updated_at } : null;
  },

  async save(row) {
    const { pb, row: existing } = await findRow(row.key);
    if (existing) await pb.collection("site_settings").update(existing.id, row);
    else await pb.collection("site_settings").create(row);
    return existing?.value ?? null;
  },

  async remove(key) {
    const { pb, row } = await findRow(key);
    if (!row) return undefined;
    await pb.collection("site_settings").delete(row.id);
    return row.value;
  },

  // PocketBase puts its own app name in auth emails ({APP_NAME}); keep it equal to SITE_NAME.
  async syncStoreName(name) {
    const pb = await createAdminPocketBase();
    await pb.settings.update({ meta: { appName: name } });
  },

  // One site_assets record per kind; uploading again replaces its file.
  async uploadAsset(kind, file) {
    const pb = await createAdminPocketBase();
    const existing = await pb
      .collection("site_assets")
      .getFirstListItem(pb.filter("kind = {:kind}", { kind }), { fields: "id" })
      .catch(() => null);
    const record = existing
      ? await pb.collection("site_assets").update(existing.id, { file })
      : await pb.collection("site_assets").create({ kind, file });
    return getFileUrl(record, record.file);
  },
};
