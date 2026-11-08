import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { AdminDiscount, DiscountCode, DiscountsBackend } from "@repo/core/backend/types";
import type { LocalizedText } from "@repo/core/lib/localized";
import {
  APPLIES_TO_ALL,
  applies_to_schema,
  type DiscountInput,
  type DiscountListFilters,
} from "@repo/core/lib/schemas/discounts";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { DiscountCodesResponse, TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

type DiscountRecord = DiscountCodesResponse<unknown>;

const pbDate = (iso: string) => iso.replace("T", " ");

export function toDiscountCode(record: DiscountRecord): DiscountCode {
  return {
    id: record.id,
    code: record.code,
    type: record.type as DiscountCode["type"],
    value: record.value,
    min_subtotal: record.min_subtotal,
    starts_at: record.starts_at,
    ends_at: record.ends_at,
    usage_limit: record.usage_limit,
    used_count: record.used_count,
    is_active: record.is_active,
    title: record.title,
    applies_to: applies_to_schema.catch(APPLIES_TO_ALL).parse(record.applies_to ?? APPLIES_TO_ALL),
    once_per_customer: record.once_per_customer,
  };
}

function toAdmin(record: DiscountRecord): AdminDiscount {
  return { ...toDiscountCode(record), created_at: record.created_at, updated_at: record.updated_at };
}

function fieldsOf(input: DiscountInput) {
  return {
    code: input.code,
    title: input.title,
    type: input.type,
    value: input.type === "free_shipping" ? 0 : input.value,
    min_subtotal: input.min_subtotal,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    usage_limit: input.usage_limit,
    once_per_customer: input.once_per_customer,
    is_active: input.is_active,
    applies_to: input.applies_to.kind === "all" ? null : input.applies_to,
  };
}

function rethrow(error: unknown): never {
  if (pocketBaseFieldCode(error, "code") === "validation_not_unique") throw new BackendError("code_taken");
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

// The same order of checks as discountStatus().
function statusFilter(pb: TypedPocketBase, status: string, now: string): string {
  const params = { now: pbDate(now) };
  const not_expired = '(ends_at = "" || ends_at >= {:now})';
  const has_uses = "(usage_limit = 0 || used_count < usage_limit)";
  const filters: Record<string, string> = {
    disabled: "is_active = false",
    expired: 'is_active = true && ends_at != "" && ends_at < {:now}',
    used_up: `is_active = true && ${not_expired} && usage_limit > 0 && used_count >= usage_limit`,
    scheduled: `is_active = true && ${not_expired} && ${has_uses} && starts_at > {:now}`,
    active: `is_active = true && ${not_expired} && ${has_uses} && (starts_at = "" || starts_at <= {:now})`,
  };
  return pb.filter(filters[status] ?? filters.active ?? "", params);
}

function buildFilter(pb: TypedPocketBase, filters: DiscountListFilters, now: string): string {
  const parts = ['deleted_at = ""'];
  if (filters.status !== "all") parts.push(`(${statusFilter(pb, filters.status, now)})`);
  if (filters.search) parts.push(pb.filter("(code ~ {:search} || title ~ {:search})", { search: filters.search }));
  return parts.join(" && ");
}

function anyOf(pb: TypedPocketBase, field: string, ids: string[]): string {
  return ids.map((id, index) => pb.filter(`${field} = {:i${index}}`, { [`i${index}`]: id })).join(" || ");
}

export const discounts: DiscountsBackend = {
  async list(filters, page_size, now) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("discount_codes").getList<DiscountRecord>(filters.page, page_size, {
      filter: buildFilter(pb, filters, now),
      sort: "-created_at,id",
    });
    return {
      items: result.items.map(toAdmin),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("discount_codes").getOne<DiscountRecord>(id).catch(rethrow);
    if (record.deleted_at) throw new BackendError("not_found");
    return toAdmin(record);
  },

  async create(input) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("discount_codes")
      .create({ ...fieldsOf(input), used_count: 0 })
      .catch(rethrow);
    return { id: record.id };
  },

  async update(id, input) {
    await discounts.get(id);
    const pb = await createAdminPocketBase();
    await pb.collection("discount_codes").update(id, fieldsOf(input)).catch(rethrow);
  },

  async delete(id) {
    const current = await discounts.get(id);
    const pb = await createAdminPocketBase();
    // The code is freed for a new discount: the deleted one keeps a renamed code
    // ("~" isn't allowed by the code pattern, so it becomes "_DELETED_<id>").
    await pb.collection("discount_codes").update(id, {
      deleted_at: new Date().toISOString(),
      is_active: false,
      code: `${current.code}_DELETED_${id}`.toUpperCase().slice(0, 50),
    });
  },

  async targets(applies_to) {
    if (applies_to.kind === "all" || applies_to.ids.length === 0) return [];
    const pb = await createAdminPocketBase();
    if (applies_to.kind === "products") {
      const rows = await pb
        .collection("products")
        .getFullList({ filter: anyOf(pb, "id", applies_to.ids), fields: "id,title" });
      return rows.map((row) => ({ id: row.id, name: (row.title as LocalizedText | null) ?? {} }));
    }
    const rows = await pb
      .collection("categories")
      .getFullList({ filter: anyOf(pb, "id", applies_to.ids), fields: "id,name" });
    return rows.map((row) => ({ id: row.id, name: (row.name as LocalizedText | null) ?? {} }));
  },

  async productIdsInCategories(category_ids) {
    if (category_ids.length === 0) return [];
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("products").getFullList({
      filter: `(${anyOf(pb, "category", category_ids)}) && deleted_at = ""`,
      fields: "id",
    });
    return rows.map((row) => row.id);
  },

  async usesByEmail(discount_id, email) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("orders").getList(1, 1, {
      filter: pb.filter('discount_code = {:id} && email = {:email} && status != "cancelled" && deleted_at = ""', {
        id: discount_id,
        email: email.toLowerCase(),
      }),
      fields: "id",
    });
    return result.totalItems;
  },
};
