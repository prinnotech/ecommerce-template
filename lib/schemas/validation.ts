import type { z } from "zod";

import type { Dictionary } from "@/lib/i18n";

// Zod messages in our schemas are keys of dictionary.validation, so forms can translate them.
export type ValidationKey = keyof Dictionary["validation"];

export type FieldErrors = Partial<Record<string, ValidationKey>>;

const KNOWN_KEYS: ValidationKey[] = [
  "required",
  "invalid_email",
  "too_long",
  "password_too_short",
  "passwords_dont_match",
  "invalid_country",
  "invalid_slug",
  "compare_at_too_low",
  "duplicate_sku",
  "phone_required",
  "invalid",
];

function isValidationKey(value: string): value is ValidationKey {
  return (KNOWN_KEYS as string[]).includes(value);
}

// First error per field, keyed by its dotted path ("email", "shipping_address.phone").
export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".");
    if (result[field]) continue;
    result[field] = isValidationKey(issue.message) ? issue.message : "invalid";
  }
  return result;
}
