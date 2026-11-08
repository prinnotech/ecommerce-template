import { ClientResponseError } from "pocketbase";

export function pocketBaseStatus(error: unknown): number | null {
  return error instanceof ClientResponseError ? error.status : null;
}

// The validation code PocketBase returned for one field (e.g. "validation_not_unique"), if any.
export function pocketBaseFieldCode(error: unknown, field: string): string | null {
  if (!(error instanceof ClientResponseError)) return null;
  const data: unknown = error.response?.data;
  if (typeof data !== "object" || data === null || !(field in data)) return null;
  const entry: unknown = (data as Record<string, unknown>)[field];
  if (typeof entry === "object" && entry !== null && "code" in entry && typeof entry.code === "string") {
    return entry.code;
  }
  return null;
}
