// Store text as flat "dotted.key" → text maps (Settings → Languages): flattening a dictionary for
// the editor and the AI, and applying an edited map over a dictionary. Pure, no server imports.

export type FlatText = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// { store: { header: { cart: "Cart" } } } → { "store.header.cart": "Cart" }
export function flattenText(value: unknown, prefix = ""): FlatText {
  if (typeof value === "string") return prefix ? { [prefix]: value } : {};
  if (!isRecord(value)) return {};
  const result: FlatText = {};
  for (const [key, inner] of Object.entries(value)) {
    Object.assign(result, flattenText(inner, prefix ? `${prefix}.${key}` : key));
  }
  return result;
}

// A copy of `base` with the edited texts in place. Keys that don't exist in `base` (renamed or
// removed since they were saved) and non-text values are ignored, so a stale edit can't break the
// dictionary's shape.
export function applyText<T>(base: T, edits: FlatText): T {
  const copy: unknown = structuredClone(base);
  for (const [dotted, text] of Object.entries(edits)) {
    if (!text) continue;
    const parts = dotted.split(".");
    let node: unknown = copy;
    for (const part of parts.slice(0, -1)) node = isRecord(node) ? node[part] : undefined;
    const last = parts.at(-1) ?? "";
    if (isRecord(node) && typeof node[last] === "string") node[last] = text;
  }
  return copy as T;
}

// The {placeholders} in a text, sorted: a translation must keep exactly the same ones.
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{[a-z_]+\}/g)].map((match) => match[0]).sort();
}

export function samePlaceholders(source: string, translation: string): boolean {
  return placeholdersOf(source).join("|") === placeholdersOf(translation).join("|");
}
