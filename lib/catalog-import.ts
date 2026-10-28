import { LOCALES } from "@/i18nConfig";
import {
  import_category_schema,
  import_product_schema,
  type ImportCategory,
  type ImportProduct,
} from "@/lib/schemas/catalog-import";

// CSV → validated import items. Pure functions: the import page runs them in the browser for the
// preview, and the server validates the items again with the same schemas.

export const PRODUCT_COLUMNS = [
  "handle",
  ...LOCALES.map((locale) => `title_${locale}`),
  ...LOCALES.map((locale) => `description_${locale}`),
  "category",
  "price",
  "compare_at_price",
  "status",
  "featured",
  "tags",
  "size",
  "color",
  "color_hex",
  "sku",
  "variant_price",
  "stock",
  "image_urls",
] as const;
const REQUIRED_PRODUCT_COLUMNS = ["handle", "price", "sku", "stock"];

export const CATEGORY_COLUMNS = [
  "handle",
  ...LOCALES.map((locale) => `name_${locale}`),
  ...LOCALES.map((locale) => `description_${locale}`),
  "parent",
  "sort_order",
  "visible",
] as const;
const REQUIRED_CATEGORY_COLUMNS = ["handle"];

const PRODUCT_EXAMPLE = [
  ["linen-shirt", "Linen shirt", "Camisa de lino", "Camicia di lino", "Breathable linen shirt.\\nRelaxed fit.", "", "", "men", "59.00", "", "active", "no", "summer|linen", "S", "White", "#f5f5f0", "LINEN-SHIRT-WHITE-S", "", "10", "https://example.com/linen-shirt-1.jpg|https://example.com/linen-shirt-2.jpg"],
  ["linen-shirt", "", "", "", "", "", "", "", "", "", "", "", "", "M", "White", "#f5f5f0", "LINEN-SHIRT-WHITE-M", "", "12", ""],
  ["linen-shirt", "", "", "", "", "", "", "", "", "", "", "", "", "M", "Sand", "#d8c7a5", "LINEN-SHIRT-SAND-M", "65.00", "5", ""],
];
const CATEGORY_EXAMPLE = [
  ["men", "Men", "Hombre", "Uomo", "", "", "", "", "0", "yes"],
  ["men-shoes", "Shoes", "Zapatos", "Scarpe", "", "", "", "men", "1", "yes"],
];

export type ImportKind = "products" | "categories";
export type ParseProblem = { line: number; message: ParseMessage; value?: string };
// Keys of dictionary.catalog.import.problems.
export type ParseMessage =
  | "missing_columns"
  | "empty_file"
  | "invalid_handle"
  | "missing_title"
  | "invalid_price"
  | "invalid_compare_at"
  | "invalid_status"
  | "invalid_sku"
  | "duplicate_sku"
  | "invalid_stock"
  | "invalid_color"
  | "invalid_parent"
  | "invalid_row";

export type ParsedImport<T> = { items: T[]; problems: ParseProblem[]; row_count: number };

// RFC 4180: quoted fields may hold commas, quotes ("") and line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let in_quotes = false;
  const source = text.replace(/^﻿/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (in_quotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') in_quotes = false;
      else field += char;
    } else if (char === '"') in_quotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function toCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function templateCsv(kind: ImportKind): string {
  const [columns, rows] =
    kind === "products" ? [PRODUCT_COLUMNS, PRODUCT_EXAMPLE] : [CATEGORY_COLUMNS, CATEGORY_EXAMPLE];
  return [columns, ...rows].map((cells) => cells.map(toCsvCell).join(",")).join("\r\n") + "\r\n";
}

// Known columns only; an extra column in the file is read and ignored.
type Column = (typeof PRODUCT_COLUMNS)[number] | (typeof CATEGORY_COLUMNS)[number];
type Row = { [K in Column]?: string } & { line: number };

function readRows(text: string, required: string[]): { rows: Row[]; problems: ParseProblem[] } {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], problems: [{ line: 1, message: "empty_file" }] };
  const columns = header.map((name) => name.trim().toLowerCase());
  const missing = required.filter((name) => !columns.includes(name));
  if (missing.length > 0) return { rows: [], problems: [{ line: 1, message: "missing_columns", value: missing.join(", ") }] };
  const rows = lines.map((cells, index) => {
    const values: Record<string, string> = {};
    columns.forEach((name, column) => {
      values[name] = (cells[column] ?? "").trim();
    });
    return { ...values, line: index + 2 } as Row;
  });
  return { rows, problems: [] };
}

// "59.00" / "59,00" / "€ 59" → 5900 cents. Empty → 0. Invalid → null.
function toCents(value: string | undefined): number | null {
  const text = (value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!text) return 0;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function localizedColumns(row: Row, prefix: "title" | "description" | "name", transform = (text: string) => text) {
  const result: Partial<Record<(typeof LOCALES)[number], string>> = {};
  for (const locale of LOCALES) {
    const text = row[`${prefix}_${locale}`];
    if (text) result[locale] = transform(text);
  }
  return result;
}

const isYes = (value: string | undefined) => ["yes", "true", "1", "si", "sì", "y"].includes((value ?? "").toLowerCase());
const splitList = (value: string | undefined) =>
  (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// One row per variant; rows with the same handle are one product whose fields come from its first row.
export function parseProductsCsv(text: string): ParsedImport<ImportProduct> {
  const { rows, problems } = readRows(text, REQUIRED_PRODUCT_COLUMNS);
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const handle = (row.handle ?? "").toLowerCase();
    groups.set(handle, [...(groups.get(handle) ?? []), row]);
  }

  const items: ImportProduct[] = [];
  const seen_skus = new Map<string, number>();
  for (const [handle, group] of groups) {
    const first = group[0]!;
    const product_problems: ParseProblem[] = [];
    const flag = (row: Row, message: ParseMessage, value?: string) => product_problems.push({ line: row.line, message, value });

    if (!SLUG.test(handle)) flag(first, "invalid_handle", handle);
    const title = localizedColumns(first, "title");
    if (Object.keys(title).length === 0) flag(first, "missing_title");
    const price = toCents(first.price);
    const compare_at_price = toCents(first.compare_at_price);
    if (!price) flag(first, "invalid_price", first.price);
    if (compare_at_price === null || (compare_at_price && price && compare_at_price <= price)) {
      flag(first, "invalid_compare_at", first.compare_at_price);
    }
    const status = (first.status || "draft").toLowerCase();
    if (!["draft", "active", "archived"].includes(status)) flag(first, "invalid_status", first.status);

    const variants = group.map((row) => {
      const sku = (row.sku ?? "").toUpperCase();
      const stock = Number(row.stock || 0);
      const price_override = toCents(row.variant_price);
      if (!sku || sku.length > 64) flag(row, "invalid_sku", row.sku);
      else if (seen_skus.has(sku)) flag(row, "duplicate_sku", sku);
      else seen_skus.set(sku, row.line);
      if (!Number.isInteger(stock) || stock < 0) flag(row, "invalid_stock", row.stock);
      if (row.color_hex && !/^#[0-9a-fA-F]{6}$/.test(row.color_hex)) flag(row, "invalid_color", row.color_hex);
      if (price_override === null) flag(row, "invalid_price", row.variant_price);
      return {
        // Database limits (pb_migrations catalog): longer supplier names are cut, not rejected.
        size: (row.size ?? "").slice(0, 30).trim(),
        color: (row.color ?? "").slice(0, 50).trim(),
        color_hex: (row.color_hex ?? "").toLowerCase(),
        sku,
        price_override: price_override ?? 0,
        stock: Number.isInteger(stock) && stock >= 0 ? stock : 0,
      };
    });

    if (product_problems.length > 0) {
      problems.push(...product_problems);
      continue;
    }
    const parsed = import_product_schema.safeParse({
      handle,
      title,
      description: localizedColumns(first, "description", (value) => value.replace(/\\n/g, "\n")),
      category: (first.category ?? "").toLowerCase(),
      price,
      compare_at_price: compare_at_price ?? 0,
      status,
      is_featured: isYes(first.featured),
      tags: splitList(first.tags).slice(0, 20),
      image_urls: splitList(first.image_urls).slice(0, 10),
      variants,
    });
    if (parsed.success) items.push(parsed.data);
    else problems.push({ line: first.line, message: "invalid_row", value: parsed.error.issues[0]?.path.join(".") });
  }
  return { items, problems, row_count: rows.length };
}

// Parents first, so a category can name a parent defined further down the file.
export function parseCategoriesCsv(text: string): ParsedImport<ImportCategory> {
  const { rows, problems } = readRows(text, REQUIRED_CATEGORY_COLUMNS);
  const handles = new Set(rows.map((row) => (row.handle ?? "").toLowerCase()));
  const items: ImportCategory[] = [];
  for (const row of rows) {
    const handle = (row.handle ?? "").toLowerCase();
    const parent = (row.parent ?? "").toLowerCase();
    if (!SLUG.test(handle)) {
      problems.push({ line: row.line, message: "invalid_handle", value: row.handle });
      continue;
    }
    if (parent && (!SLUG.test(parent) || parent === handle)) {
      problems.push({ line: row.line, message: "invalid_parent", value: row.parent });
      continue;
    }
    const name = localizedColumns(row, "name");
    const parsed = import_category_schema.safeParse({
      handle,
      // No name given: "men-shoes" → "Men Shoes" in every language, editable later.
      name: Object.keys(name).length > 0 ? name : Object.fromEntries(LOCALES.map((locale) => [locale, titleCase(handle)])),
      description: localizedColumns(row, "description", (value) => value.replace(/\\n/g, "\n")),
      parent,
      sort_order: Number(row.sort_order || 0) || 0,
      is_active: row.visible === undefined || row.visible === "" ? true : isYes(row.visible),
    });
    if (parsed.success) items.push(parsed.data);
    else problems.push({ line: row.line, message: "invalid_row", value: parsed.error.issues[0]?.path.join(".") });
  }
  const parent_of = new Map(items.map((item) => [item.handle, item.parent]));
  const depth = (handle: string, seen = new Set<string>()): number => {
    const parent = parent_of.get(handle);
    if (!parent || !handles.has(parent) || seen.has(parent)) return 0;
    seen.add(handle);
    return 1 + depth(parent, seen);
  };
  items.sort((a, b) => depth(a.handle) - depth(b.handle));
  return { items, problems, row_count: rows.length };
}

export function titleCase(handle: string): string {
  return handle.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
