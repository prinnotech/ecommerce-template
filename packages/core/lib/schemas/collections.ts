import { z } from "zod";

import { localized_text_schema } from "@repo/core/lib/localized";
import { slug_schema } from "@repo/core/lib/schemas/catalog";
import { id_schema } from "@repo/core/lib/schemas/ids";
import { EMPTY_SEO, seo_schema } from "@repo/core/lib/schemas/seo";

// Products → Collections: groups of products picked by hand ("manual") or by rules
// ("automatic"), each with its own page at /{lang}/collections/{slug}.

export const COLLECTION_KINDS = ["manual", "automatic"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export const COLLECTION_SORTS = ["manual", "newest", "price_asc", "price_desc", "title"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

// Rule fields: a tag, the category, the price (cents), on sale (compare-at price set), in stock.
export const RULE_FIELDS = ["tag", "category", "price", "on_sale", "in_stock"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPERATORS = ["is", "is_not", "greater_than", "less_than"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

// Which operators each field allows (the editor offers only these).
export const FIELD_OPERATORS: Record<RuleField, readonly RuleOperator[]> = {
  tag: ["is", "is_not"],
  category: ["is", "is_not"],
  price: ["greater_than", "less_than"],
  on_sale: ["is"],
  in_stock: ["is"],
};

export const rule_schema = z
  .object({
    field: z.enum(RULE_FIELDS),
    operator: z.enum(RULE_OPERATORS),
    // Tag text, category id, price in cents, or "true"/"false".
    value: z.string().trim().min(1).max(100),
  })
  .refine((rule) => FIELD_OPERATORS[rule.field].includes(rule.operator), { path: ["operator"] })
  .refine((rule) => !["price"].includes(rule.field) || /^\d+$/.test(rule.value), { path: ["value"] });
export type CollectionRule = z.infer<typeof rule_schema>;

export const rules_schema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(rule_schema).max(20),
});
export type CollectionRules = z.infer<typeof rules_schema>;
export const EMPTY_RULES: CollectionRules = { match: "all", conditions: [] };

const title_schema = localized_text_schema.refine(
  (value) => Object.values(value).some((text) => (text ?? "").trim().length > 0),
  "required",
);

export const collection_schema = z
  .object({
    title: title_schema,
    slug: slug_schema,
    description: localized_text_schema,
    // From the media library (Online store → images) or a link; "" = no image.
    image_url: z.union([z.url().max(1000), z.string().startsWith("/").max(1000), z.literal("")]),
    kind: z.enum(COLLECTION_KINDS),
    rules: rules_schema,
    sort: z.enum(COLLECTION_SORTS),
    is_published: z.boolean(),
    seo: seo_schema,
  })
  .refine((input) => input.kind === "manual" || input.rules.conditions.length > 0, { path: ["rules"] })
  .refine((input) => input.kind === "manual" || input.sort !== "manual", { path: ["sort"] });
export type CollectionInput = z.infer<typeof collection_schema>;

export const EMPTY_COLLECTION: CollectionInput = {
  title: {},
  slug: "",
  description: {},
  image_url: "",
  kind: "manual",
  rules: EMPTY_RULES,
  sort: "manual",
  is_published: true,
  seo: EMPTY_SEO,
};

export const collection_products_schema = z.object({
  id: id_schema,
  product_ids: z.array(id_schema).max(1000),
});

// What rule matching needs about a live product.
export type ProductFacts = {
  id: string;
  title: string;
  tags: string[];
  category_id: string;
  price: number;
  compare_at_price: number;
  in_stock: boolean;
  created_at: string;
};

function matches(rule: CollectionRule, product: ProductFacts): boolean {
  const value = rule.value.toLowerCase();
  switch (rule.field) {
    case "tag": {
      const has = product.tags.some((tag) => tag.toLowerCase() === value);
      return rule.operator === "is" ? has : !has;
    }
    case "category":
      return rule.operator === "is" ? product.category_id === rule.value : product.category_id !== rule.value;
    case "price": {
      const amount = Number(rule.value);
      return rule.operator === "greater_than" ? product.price > amount : product.price < amount;
    }
    case "on_sale":
      return product.compare_at_price > product.price === (value === "true");
    case "in_stock":
      return product.in_stock === (value === "true");
    default:
      return false;
  }
}

export function matchesRules(rules: CollectionRules, product: ProductFacts): boolean {
  if (rules.conditions.length === 0) return false;
  return rules.match === "all"
    ? rules.conditions.every((rule) => matches(rule, product))
    : rules.conditions.some((rule) => matches(rule, product));
}

export function sortProducts(products: ProductFacts[], sort: CollectionSort): ProductFacts[] {
  const sorted = [...products];
  if (sort === "newest") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
  if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
  return sorted;
}
