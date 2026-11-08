// Unique-constraint violations, as reported by Postgres (code 23505, constraint name) or
// SQLite ("UNIQUE constraint failed: products.slug"). Returns the offending text to match on.
export function uniqueViolation(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const details = error as { code?: unknown; constraint?: unknown; detail?: unknown; message?: unknown };
  if (details.code === "23505") return `${String(details.constraint ?? "")} ${String(details.detail ?? "")}`;
  const message = String(details.message ?? "");
  return message.includes("UNIQUE constraint failed") ? message : null;
}

// A failed CHECK (stock >= 0): someone bought the last units first.
export function checkViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const details = error as { code?: unknown; message?: unknown };
  return details.code === "23514" || String(details.message ?? "").includes("CHECK constraint failed");
}
