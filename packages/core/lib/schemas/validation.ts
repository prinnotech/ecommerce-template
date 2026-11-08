import type { z } from "zod";

import type { Dictionary } from "@repo/core/lib/i18n";

// Zod messages in our schemas are keys of dictionary.validation, so forms can translate them.
export type ValidationKey = keyof Dictionary["validation"];

export type FieldErrors = Partial<Record<string, ValidationKey>>;

// Every key of dictionary.validation: a key added to the dictionary but not here fails to compile,
// so a schema's message never silently turns into the generic "invalid".
const KNOWN_KEYS = {
  required: true,
  invalid_email: true,
  too_long: true,
  too_short: true,
  password_too_short: true,
  passwords_dont_match: true,
  invalid_country: true,
  invalid_slug: true,
  invalid_domain: true,
  compare_at_too_low: true,
  duplicate_sku: true,
  phone_required: true,
  invalid: true,
} satisfies Record<ValidationKey, true>;

function isValidationKey(value: string): value is ValidationKey {
  return Object.hasOwn(KNOWN_KEYS, value);
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
