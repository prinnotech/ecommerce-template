"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize } from "@repo/core/lib/auth";
import { buildCustomers } from "@repo/core/lib/customers";
import { id_schema } from "@repo/core/lib/schemas/ids";
import {
  matchesSegment,
  segment_input_schema,
  segment_rules_schema,
  type Segment,
  type SegmentInput,
  type SegmentRules,
} from "@repo/core/lib/schemas/segments";

// Customers → Segments: saved filters, shown as views of the customer list and used by campaigns.

export async function getSegments(): Promise<ActionResult<Segment[]>> {
  const auth = await authorize("customers.view", "view customer segments");
  if (!auth.ok) return auth;
  try {
    const records = await getBackend().segments.list();
    return ok(
      records.flatMap((record) => {
        const rules = segment_rules_schema.safeParse(record.rules);
        return rules.success ? [{ id: record.id, name: record.name, rules: rules.data }] : [];
      }),
    );
  } catch (error) {
    return failFrom(error, "segments", "getSegments");
  }
}

// How many customers match, for the editor's live preview.
export async function countSegment(rules: SegmentRules): Promise<ActionResult<{ count: number; subscribed: number }>> {
  const auth = await authorize("customers.view", "preview a customer segment");
  if (!auth.ok) return auth;
  const parsed = segment_rules_schema.safeParse(rules);
  if (!parsed.success) return fail("invalid_input");
  try {
    const now = Date.now();
    const matching = (await buildCustomers()).filter((customer) => matchesSegment(customer, parsed.data, now));
    return ok({
      count: matching.length,
      subscribed: matching.filter((customer) => customer.is_registered && customer.accepts_marketing).length,
    });
  } catch (error) {
    return failFrom(error, "segments", "countSegment");
  }
}

export async function saveSegment(input: {
  id: string | null;
  segment: SegmentInput;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("customers.edit", "save a customer segment");
  if (!auth.ok) return auth;
  const parsed = segment_input_schema.safeParse(input.segment);
  if (!parsed.success) return fail("invalid_input");
  if (input.id !== null && !id_schema.safeParse(input.id).success) return fail("not_found");
  try {
    const backend = getBackend().segments;
    let id = input.id;
    if (id) await backend.update(id, parsed.data);
    else id = (await backend.create(parsed.data)).id;
    await logActivity({
      actor_id: auth.caller.user_id,
      action: input.id ? "edit a customer segment" : "create a customer segment",
      target_type: "customer_segments",
      target_id: id,
      details: { name: parsed.data.name },
    });
    return ok({ id });
  } catch (error) {
    return failFrom(error, "segments", "saveSegment");
  }
}

// Campaigns already sent keep their numbers; drafts that used it fall back to "all subscribers".
export async function deleteSegment(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("customers.edit", "delete a customer segment");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().segments.remove(id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "delete a customer segment",
      target_type: "customer_segments",
      target_id: id,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "segments", "deleteSegment");
  }
}
