import { z } from "zod";

// Customers → Segments: saved filters over the customer list ("spent over €200 and ordered in the
// last 90 days"). Matched in memory against the same rows the list shows.

const DAY_MS = 24 * 60 * 60 * 1000;

export const segment_condition_schema = z.discriminatedUnion("field", [
  // Amounts in cents; "total spent" leaves out cancelled and refunded orders.
  z.object({ field: z.literal("total_spent"), op: z.enum(["gte", "lte"]), value: z.number().int().min(0) }),
  z.object({ field: z.literal("order_count"), op: z.enum(["gte", "lte", "eq"]), value: z.number().int().min(0) }),
  // Days: "within 30" = in the last 30 days; "not_within 30" also matches customers who never ordered.
  z.object({
    field: z.literal("last_order"),
    op: z.enum(["within", "not_within"]),
    value: z.number().int().min(1).max(3650),
  }),
  z.object({
    field: z.literal("signed_up"),
    op: z.enum(["within", "not_within"]),
    value: z.number().int().min(1).max(3650),
  }),
  z.object({ field: z.literal("accepts_marketing"), value: z.boolean() }),
  z.object({ field: z.literal("country"), op: z.enum(["is", "is_not"]), value: z.string().regex(/^[A-Z]{2}$/) }),
  z.object({ field: z.literal("customer_type"), value: z.enum(["registered", "guest"]) }),
]);
export type SegmentCondition = z.infer<typeof segment_condition_schema>;
export type SegmentField = SegmentCondition["field"];
export const SEGMENT_FIELDS = [
  "total_spent",
  "order_count",
  "last_order",
  "signed_up",
  "accepts_marketing",
  "country",
  "customer_type",
] as const satisfies readonly SegmentField[];

export const segment_rules_schema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(segment_condition_schema).min(1).max(10),
});
export type SegmentRules = z.infer<typeof segment_rules_schema>;

export const segment_input_schema = z.object({
  name: z.string().trim().min(1).max(80),
  rules: segment_rules_schema,
});
export type SegmentInput = z.infer<typeof segment_input_schema>;

export type Segment = SegmentInput & { id: string };

// What a condition needs to know about a customer (the customer list's rows have all of it).
export type SegmentSubject = {
  is_registered: boolean;
  accepts_marketing: boolean;
  order_count: number;
  total_spent: number;
  last_order_at: string;
  created_at: string;
  country: string;
};

function daysAgo(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / DAY_MS;
}

function matchesCondition(customer: SegmentSubject, condition: SegmentCondition, now: number): boolean {
  switch (condition.field) {
    case "total_spent":
      return condition.op === "gte" ? customer.total_spent >= condition.value : customer.total_spent <= condition.value;
    case "order_count":
      if (condition.op === "eq") return customer.order_count === condition.value;
      return condition.op === "gte" ? customer.order_count >= condition.value : customer.order_count <= condition.value;
    case "last_order": {
      const is_within = Boolean(customer.last_order_at) && daysAgo(customer.last_order_at, now) <= condition.value;
      return condition.op === "within" ? is_within : !is_within;
    }
    case "signed_up": {
      const is_within = Boolean(customer.created_at) && daysAgo(customer.created_at, now) <= condition.value;
      return condition.op === "within" ? is_within : !is_within;
    }
    case "accepts_marketing":
      return customer.accepts_marketing === condition.value;
    case "country":
      return condition.op === "is" ? customer.country === condition.value : customer.country !== condition.value;
    case "customer_type":
      return customer.is_registered === (condition.value === "registered");
  }
}

export function matchesSegment(customer: SegmentSubject, rules: SegmentRules, now = Date.now()): boolean {
  const results = rules.conditions.map((condition) => matchesCondition(customer, condition, now));
  return rules.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

// A starting condition per field, for the editor's "Add condition".
export function defaultCondition(field: SegmentField): SegmentCondition {
  switch (field) {
    case "total_spent":
      return { field, op: "gte", value: 10000 };
    case "order_count":
      return { field, op: "gte", value: 2 };
    case "last_order":
      return { field, op: "within", value: 30 };
    case "signed_up":
      return { field, op: "within", value: 30 };
    case "accepts_marketing":
      return { field, value: true };
    case "country":
      return { field, op: "is", value: "IT" };
    case "customer_type":
      return { field, value: "registered" };
  }
}
