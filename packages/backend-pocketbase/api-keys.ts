import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { ApiKeysBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { UsersResponse } from "@repo/backend-pocketbase/pocketbase-types";

type WithUser = { expand?: { user?: UsersResponse } };

export const api_keys: ApiKeysBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("api_keys").getFullList({ sort: "-created_at", expand: "user" });
    return rows.map((row) => {
      const record = row as typeof row & WithUser;
      return {
        id: record.id,
        name: record.name,
        key_prefix: record.key_prefix,
        user_id: record.user,
        user_email: record.expand?.user?.email ?? "",
        last_used_at: record.last_used_at || null,
        revoked_at: record.revoked_at || null,
        created_at: record.created_at,
      };
    });
  },

  async create(input) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("api_keys").create({
      user: input.user_id,
      name: input.name,
      key_prefix: input.key_prefix,
      key_hash: input.key_hash,
    });
    return { id: record.id };
  },

  async revoke(id) {
    const pb = await createAdminPocketBase();
    await pb
      .collection("api_keys")
      .update(id, { revoked_at: new Date().toISOString() })
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
        throw error;
      });
  },

  async findActive(key_hash) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("api_keys").getList(1, 1, {
      filter: pb.filter('key_hash = {:hash} && revoked_at = ""', { hash: key_hash }),
      expand: "user",
      skipTotal: true,
    });
    const record = result.items[0] as ((typeof result.items)[number] & WithUser) | undefined;
    const user = record?.expand?.user;
    if (!record || !user) return null;
    return {
      id: record.id,
      user: { id: user.id, email: user.email, name: user.name ?? "", phone: user.phone ?? "", verified: user.verified },
    };
  },

  async touch(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("api_keys").update(id, { last_used_at: new Date().toISOString() });
  },
};
