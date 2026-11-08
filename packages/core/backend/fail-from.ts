import "server-only";

import { isBackendError } from "@repo/core/backend/errors";
import { fail } from "@repo/core/lib/action-result";
import { reportError } from "@repo/core/lib/server-log";

// The catch block of every action: an expected backend failure becomes its error code,
// anything else is reported and shown as the generic error.
export async function failFrom(error: unknown, module: string, context: string) {
  if (isBackendError(error)) return fail(error.code);
  await reportError(module, context, error);
  return fail("generic");
}
