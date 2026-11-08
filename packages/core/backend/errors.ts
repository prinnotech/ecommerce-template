import type { ErrorCode } from "@repo/core/lib/action-result";

// An expected failure a backend reports in the same way whichever database it uses
// ("not_found", "slug_taken", "sku_taken"…). Actions turn it into fail(code); anything
// else a backend throws is unexpected and gets reported.
export class BackendError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

export function isBackendError(error: unknown): error is BackendError {
  return error instanceof BackendError;
}
