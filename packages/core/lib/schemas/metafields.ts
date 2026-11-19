import { z } from "zod";

import { localized_text_schema, type LocalizedText } from "@repo/core/lib/localized";
import { url_or_path_schema } from "@repo/core/lib/schemas/theme";

// Settings → Custom data: extra fields for products, collections and customers ("metafields").
// Definitions say which fields exist; each product/collection/customer keeps its own values.

export const METAFIELD_OWNERS = ["product", "collection", "customer"] as const;
export type MetafieldOwner = (typeof METAFIELD_OWNERS)[number];

export const METAFIELD_TYPES = ["text", "multiline", "number", "boolean", "date", "url", "color", "file"] as const;
export type MetafieldType = (typeof METAFIELD_TYPES)[number];

export const MAX_METAFIELD_DEFINITIONS = 50;

function hasText(text: LocalizedText): boolean {
  return Object.values(text).some((value) => value.trim().length > 0);
}

// The key never changes once created: themes and integrations refer to it.
export const metafield_key_schema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "invalid_key");

export const metafield_definition_schema = z
  .object({
    owner: z.enum(METAFIELD_OWNERS),
    key: metafield_key_schema,
    name: localized_text_schema,
    description: localized_text_schema,
    type: z.enum(METAFIELD_TYPES),
    // Shown on the store (product and collection fields only; customer fields stay private).
    is_storefront: z.boolean(),
  })
  .refine((input) => hasText(input.name), { path: ["name"] });
export type MetafieldDefinitionInput = z.infer<typeof metafield_definition_schema>;

export type MetafieldDefinition = MetafieldDefinitionInput & { id: string; position: number };

// One value per type. Text is per store language, like the rest of the store's content.
const VALUE_SCHEMAS = {
  text: z.record(z.string(), z.string().max(500)),
  multiline: z.record(z.string(), z.string().max(5000)),
  number: z.number().finite(),
  boolean: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  url: url_or_path_schema.refine((value) => value !== ""),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  file: url_or_path_schema.refine((value) => value !== ""),
} satisfies Record<MetafieldType, z.ZodType>;

export type MetafieldValue = LocalizedText | number | boolean | string;
export type MetafieldValues = Record<string, MetafieldValue>;

export function isEmptyValue(value: MetafieldValue | undefined): boolean {
  if (value === undefined || value === "") return true;
  if (typeof value === "object") return !hasText(value);
  return false;
}

// Only the values of fields that exist, in the field's type; anything else is dropped. Empty
// values are dropped too, so "cleared" means "not set".
export function parseMetafieldValues(definitions: MetafieldDefinition[], raw: unknown): MetafieldValues {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const values: MetafieldValues = {};
  for (const definition of definitions) {
    const parsed = VALUE_SCHEMAS[definition.type].safeParse(source[definition.key]);
    if (parsed.success && !isEmptyValue(parsed.data as MetafieldValue)) {
      values[definition.key] = parsed.data as MetafieldValue;
    }
  }
  return values;
}

export const set_metafields_schema = z.object({
  owner: z.enum(METAFIELD_OWNERS),
  // A product or collection id, or a customer key (user id or g<id> for guests).
  owner_key: z.string().min(1).max(60),
  values: z.record(z.string(), z.unknown()),
});
export type SetMetafieldsInput = z.infer<typeof set_metafields_schema>;

// A field as the store shows it: its name and value (already in the visitor's language for text).
export type StoreMetafield = { key: string; name: LocalizedText; type: MetafieldType; value: MetafieldValue };
