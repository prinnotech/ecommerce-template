"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { MetafieldDefinitionRecord } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { localized_text_schema } from "@repo/core/lib/localized";
import type { Permission } from "@repo/core/lib/permissions";
import { customer_key_schema } from "@repo/core/lib/schemas/customers";
import { id_schema } from "@repo/core/lib/schemas/ids";
import {
  MAX_METAFIELD_DEFINITIONS,
  METAFIELD_OWNERS,
  METAFIELD_TYPES,
  metafield_definition_schema,
  parseMetafieldValues,
  set_metafields_schema,
  type MetafieldDefinition,
  type MetafieldDefinitionInput,
  type MetafieldOwner,
  type MetafieldValues,
  type SetMetafieldsInput,
  type StoreMetafield,
} from "@repo/core/lib/schemas/metafields";
import { revalidateStore } from "@repo/core/lib/store-revalidate";

// Settings → Custom data (the definitions) and the "Custom fields" card on product, collection and
// customer pages (the values). The store shows the values of fields marked for it.

const VIEW: Record<MetafieldOwner, Permission> = {
  product: "products.view",
  collection: "collections.view",
  customer: "customers.view",
};
const EDIT: Record<MetafieldOwner, Permission> = {
  product: "products.edit",
  collection: "collections.edit",
  customer: "customers.edit",
};

function toDefinition(record: MetafieldDefinitionRecord): MetafieldDefinition | null {
  const owner = METAFIELD_OWNERS.find((item) => item === record.owner);
  const type = METAFIELD_TYPES.find((item) => item === record.type);
  if (!owner || !type) return null;
  const name = localized_text_schema.safeParse(record.name);
  const description = localized_text_schema.safeParse(record.description);
  return {
    id: record.id,
    owner,
    key: record.key,
    name: name.success ? name.data : {},
    description: description.success ? description.data : {},
    type,
    // Customer fields are never shown on the store.
    is_storefront: owner !== "customer" && record.is_storefront,
    position: record.position,
  };
}

async function definitionsFor(owner?: MetafieldOwner): Promise<MetafieldDefinition[]> {
  const records = await getBackend().metafields.listDefinitions(owner);
  return records.flatMap((record) => toDefinition(record) ?? []);
}

function isOwnerKey(owner: MetafieldOwner, owner_key: string): boolean {
  return owner === "customer"
    ? customer_key_schema.safeParse(owner_key).success
    : id_schema.safeParse(owner_key).success;
}

// ---------- Definitions (Settings → Custom data) ----------

export async function getMetafieldDefinitions(): Promise<ActionResult<MetafieldDefinition[]>> {
  const auth = await authorize("settings.view", "view custom data");
  if (!auth.ok) return auth;
  try {
    return ok(await definitionsFor());
  } catch (error) {
    return failFrom(error, "metafields", "getMetafieldDefinitions");
  }
}

export async function createMetafieldDefinition(
  input: MetafieldDefinitionInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("settings.edit", "create a custom field");
  if (!auth.ok) return auth;
  const parsed = metafield_definition_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const existing = await definitionsFor(parsed.data.owner);
    if (existing.length >= MAX_METAFIELD_DEFINITIONS) return fail("invalid_input");
    const { id } = await getBackend().metafields.createDefinition({
      ...parsed.data,
      is_storefront: parsed.data.owner !== "customer" && parsed.data.is_storefront,
      position: existing.length,
    });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "create a custom field",
      target_type: "metafield_definitions",
      target_id: id,
      details: { owner: parsed.data.owner, key: parsed.data.key, type: parsed.data.type },
    });
    return ok({ id });
  } catch (error) {
    return failFrom(error, "metafields", "createMetafieldDefinition");
  }
}

// The owner and key stay as created; the rest can change.
export async function updateMetafieldDefinition(input: {
  id: string;
  definition: MetafieldDefinitionInput;
}): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "edit a custom field");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success) return fail("not_found");
  const parsed = metafield_definition_schema.safeParse(input.definition);
  if (!parsed.success) return fail("invalid_input");
  try {
    const current = (await definitionsFor()).find((definition) => definition.id === input.id);
    if (!current) return fail("not_found");
    await getBackend().metafields.updateDefinition(input.id, {
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type,
      is_storefront: current.owner !== "customer" && parsed.data.is_storefront,
      position: current.position,
    });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit a custom field",
      target_type: "metafield_definitions",
      target_id: input.id,
      details: { key: current.key, type: parsed.data.type },
    });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "metafields", "updateMetafieldDefinition");
  }
}

// Swaps a field with its neighbour in the owner's list.
export async function moveMetafieldDefinition(input: { id: string; direction: -1 | 1 }): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "reorder custom fields");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(input.id).success || (input.direction !== -1 && input.direction !== 1)) {
    return fail("invalid_input");
  }
  try {
    const all = await definitionsFor();
    const current = all.find((definition) => definition.id === input.id);
    if (!current) return fail("not_found");
    const list = all.filter((definition) => definition.owner === current.owner);
    const index = list.indexOf(current);
    const other = list[index + input.direction];
    if (!other) return ok(null);
    list[index] = other;
    list[index + input.direction] = current;
    // Rewrites every position, which also repairs gaps left by deleted fields.
    for (const [position, definition] of list.entries()) {
      if (definition.position === position) continue;
      await getBackend().metafields.updateDefinition(definition.id, {
        name: definition.name,
        description: definition.description,
        type: definition.type,
        is_storefront: definition.is_storefront,
        position,
      });
    }
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "metafields", "moveMetafieldDefinition");
  }
}

export async function deleteMetafieldDefinition(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "delete a custom field");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().metafields.deleteDefinition(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a custom field",
      target_type: "metafield_definitions",
      target_id: id,
    });
    await revalidateStore();
    return ok(null);
  } catch (error) {
    return failFrom(error, "metafields", "deleteMetafieldDefinition");
  }
}

// ---------- Values (the Custom fields card) ----------

export type MetafieldsView = { definitions: MetafieldDefinition[]; values: MetafieldValues };

export async function getMetafields(input: {
  owner: MetafieldOwner;
  owner_key: string;
}): Promise<ActionResult<MetafieldsView>> {
  const owner = METAFIELD_OWNERS.find((item) => item === input.owner);
  if (!owner) return fail("invalid_input");
  const auth = await authorize(VIEW[owner], "view custom fields");
  if (!auth.ok) return auth;
  if (!isOwnerKey(owner, input.owner_key)) return fail("not_found");
  try {
    const definitions = await definitionsFor(owner);
    const raw = definitions.length > 0 ? await getBackend().metafields.getValues(owner, input.owner_key) : {};
    return ok({ definitions, values: parseMetafieldValues(definitions, raw) });
  } catch (error) {
    return failFrom(error, "metafields", "getMetafields");
  }
}

// Saves every field of the record at once. Values of fields that no longer exist are kept, so a
// field deleted by mistake and created again with the same key finds its values.
export async function setMetafields(input: SetMetafieldsInput): Promise<ActionResult<MetafieldValues>> {
  const parsed = set_metafields_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { owner, owner_key } = parsed.data;
  const auth = await authorize(EDIT[owner], "edit custom fields");
  if (!auth.ok) return auth;
  if (!isOwnerKey(owner, owner_key)) return fail("not_found");
  try {
    const backend = getBackend().metafields;
    const definitions = await definitionsFor(owner);
    const values = parseMetafieldValues(definitions, parsed.data.values);
    const current = await backend.getValues(owner, owner_key);
    const kept = typeof current === "object" && current !== null ? (current as Record<string, unknown>) : {};
    const defined = new Set(definitions.map((definition) => definition.key));
    const others = Object.fromEntries(Object.entries(kept).filter(([key]) => !defined.has(key)));
    await backend.setValues(owner, owner_key, { ...others, ...values }, auth.caller.user_id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit custom fields",
      target_type: owner,
      target_id: owner_key,
      details: { keys: Object.keys(values) },
    });
    if (owner !== "customer") await revalidateStore();
    return ok(values);
  } catch (error) {
    return failFrom(error, "metafields", "setMetafields");
  }
}

// Public: a product's or collection's fields that are shown on the store, in their order.
export async function getStoreMetafields(
  owner: "product" | "collection",
  owner_key: string,
): Promise<ActionResult<StoreMetafield[]>> {
  if (!METAFIELD_OWNERS.includes(owner) || owner === ("customer" as string)) return fail("invalid_input");
  if (!id_schema.safeParse(owner_key).success) return fail("not_found");
  try {
    const definitions = (await definitionsFor(owner)).filter((definition) => definition.is_storefront);
    if (definitions.length === 0) return ok([]);
    const values = parseMetafieldValues(definitions, await getBackend().metafields.getValues(owner, owner_key));
    return ok(
      definitions.flatMap((definition) => {
        const value = values[definition.key];
        return value === undefined
          ? []
          : [{ key: definition.key, name: definition.name, type: definition.type, value }];
      }),
    );
  } catch (error) {
    return failFrom(error, "metafields", "getStoreMetafields");
  }
}
