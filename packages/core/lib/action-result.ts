import type { Dictionary } from "@repo/core/lib/i18n";

// Error codes are keys of dictionary.errors, so every error the user sees is translated.
export type ErrorCode = keyof Dictionary["errors"];

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ErrorCode): { ok: false; error: ErrorCode } {
  return { ok: false, error };
}

export class ActionError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

// Turns an ActionResult into data or a thrown ActionError (for TanStack Query).
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new ActionError(result.error);
  return result.data;
}

export function errorText(errors: Dictionary["errors"], error: unknown): string {
  if (error instanceof ActionError) return errors[error.code];
  return errors.generic;
}
