"use server";

import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { ApiKey } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { currentApiUser, generateApiKey } from "@repo/core/lib/api-keys";
import { authorize } from "@repo/core/lib/auth";
import { id_schema } from "@repo/core/lib/schemas/ids";

const name_schema = z.string().trim().min(1).max(80);

export async function getApiKeys(): Promise<ActionResult<ApiKey[]>> {
  const auth = await authorize("api_keys.view", "view API keys");
  if (!auth.ok) return auth;
  try {
    return ok(await getBackend().api_keys.list());
  } catch (error) {
    return failFrom(error, "api-keys", "getApiKeys");
  }
}

// The key is returned once, here; afterwards only its first characters are known.
export async function createApiKey(input: { name: string }): Promise<ActionResult<{ key: string }>> {
  const auth = await authorize("api_keys.edit", "create an API key");
  if (!auth.ok) return auth;
  // A key can't make more keys: that would let a leaked key outlive its revocation.
  if (currentApiUser()) return fail("forbidden");
  const parsed = name_schema.safeParse(input.name);
  if (!parsed.success) return fail("invalid_input");
  try {
    const generated = generateApiKey();
    const created = await getBackend().api_keys.create({
      user_id: auth.caller.user_id,
      name: parsed.data,
      key_prefix: generated.key_prefix,
      key_hash: generated.key_hash,
    });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create an API key",
      target_type: "api_key",
      target_id: created.id,
      details: { name: parsed.data },
    });
    return ok({ key: generated.key });
  } catch (error) {
    return failFrom(error, "api-keys", "createApiKey");
  }
}

export async function revokeApiKey(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("api_keys.edit", "revoke an API key");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().api_keys.revoke(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "revoke an API key",
      target_type: "api_key",
      target_id: id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "api-keys", "revokeApiKey");
  }
}
