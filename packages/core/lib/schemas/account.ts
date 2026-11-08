import { z } from "zod";

import { COUNTRY_CODES } from "@repo/core/lib/locale/countries";
import { new_password_schema } from "@repo/core/lib/schemas/auth";
import { id_schema } from "@repo/core/lib/schemas/ids";

const optionalText = (max: number) => z.string().trim().max(max, "too_long");
const requiredText = (max: number) => z.string("required").trim().min(1, "required").max(max, "too_long");

export const profile_schema = z.object({
  name: requiredText(120),
  phone: optionalText(30),
});
export type ProfileInput = z.infer<typeof profile_schema>;

export const change_password_schema = z
  .object({
    old_password: z.string("required").min(1, "required").max(72, "too_long"),
    password: new_password_schema,
    password_confirm: z.string("required"),
  })
  .refine((value) => value.password === value.password_confirm, {
    message: "passwords_dont_match",
    path: ["password_confirm"],
  });
export type ChangePasswordInput = z.infer<typeof change_password_schema>;

// Shared by the address book and checkout (orders store it as a snapshot).
export const address_fields_schema = z.object({
  full_name: requiredText(120),
  phone: optionalText(30),
  line1: requiredText(200),
  line2: optionalText(200),
  city: requiredText(100),
  region: optionalText(100),
  postal_code: optionalText(20),
  country: z.enum(COUNTRY_CODES, "invalid_country"),
});
export type AddressFields = z.infer<typeof address_fields_schema>;

export const address_schema = address_fields_schema.extend({ is_default: z.boolean() });
export type AddressInput = z.infer<typeof address_schema>;

export const update_address_schema = address_schema.extend({ id: z.string().min(1).max(15) });
export type UpdateAddressInput = z.infer<typeof update_address_schema>;

export const record_id_schema = id_schema;
