import { z } from "zod";

export const email_schema = z
  .string("required")
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(200, "too_long")
  .pipe(z.email("invalid_email"));

// PocketBase's minimum is 8; bcrypt ignores anything past 72 bytes.
export const new_password_schema = z.string("required").min(8, "password_too_short").max(72, "too_long");

export const sign_in_schema = z.object({
  email: email_schema,
  password: z.string("required").min(1, "required").max(72, "too_long"),
});
export type SignInInput = z.infer<typeof sign_in_schema>;

export const sign_up_schema = z
  .object({
    name: z.string("required").trim().min(1, "required").max(120, "too_long"),
    email: email_schema,
    password: new_password_schema,
    password_confirm: z.string("required"),
  })
  .refine((value) => value.password === value.password_confirm, {
    message: "passwords_dont_match",
    path: ["password_confirm"],
  });
export type SignUpInput = z.infer<typeof sign_up_schema>;

export const request_password_reset_schema = z.object({ email: email_schema });
export type RequestPasswordResetInput = z.infer<typeof request_password_reset_schema>;

export const confirm_password_reset_schema = z
  .object({
    token: z.string("required").min(1, "required").max(2000, "too_long"),
    password: new_password_schema,
    password_confirm: z.string("required"),
  })
  .refine((value) => value.password === value.password_confirm, {
    message: "passwords_dont_match",
    path: ["password_confirm"],
  });
export type ConfirmPasswordResetInput = z.infer<typeof confirm_password_reset_schema>;
