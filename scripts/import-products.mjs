// Imports products and variants from a CSV file (template: Dashboard → Products → Import CSV → Download template).
// Usage: npm run import-products -- path/to/products.csv
// One row per variant; rows with the same handle are one product, whose fields come from its
// first row. Re-running updates existing products (by handle) and variants (by SKU).
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { getSeedBackend } from "./seed-backend.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const LOCALES = ["en", "es", "it"];
const STATUSES = ["draft", "active", "archived"];
const REQUIRED_COLUMNS = ["handle", "title_en", "price", "sku", "stock"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const csv_path = process.argv[2];
if (!csv_path || !existsSync(csv_path)) {
  console.error("Usage: npm run import-products -- path/to/products.csv");
  process.exit(1);
}

// RFC 4180: quoted fields may contain commas, quotes ("") and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let in_quotes = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (in_quotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') in_quotes = false;
      else field += char;
    } else if (char === '"') in_quotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
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

// "59.00" / "59,00" → 5900 cents. Empty → null.
function toCents(value) {
  const text = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`invalid price "${value}"`);
  return Math.round(amount * 100);
}

function localized(row, prefix, transform = (text) => text) {
  const result = {};
  for (const locale of LOCALES) {
    const text = (row[`${prefix}_${locale}`] ?? "").trim();
    if (text) result[locale] = transform(text);
  }
  return result;
}

function titleCase(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const [header, ...lines] = parseCsv(readFileSync(csv_path, "utf8").replace(/^﻿/, ""));
const columns = header.map((name) => name.trim().toLowerCase());
const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
if (missing.length > 0) {
  console.error(`Missing columns: ${missing.join(", ")}`);
  process.exit(1);
}
const records = lines.map((cells, index) => ({
  line: index + 2,
  ...Object.fromEntries(columns.map((name, column) => [name, (cells[column] ?? "").trim()])),
}));

// Group rows by handle, keeping file order.
const products = new Map();
for (const record of records) {
  if (!products.has(record.handle)) products.set(record.handle, []);
  products.get(record.handle).push(record);
}

const backend = await getSeedBackend();

const errors = [];
const stats = { products_created: 0, products_updated: 0, variants_created: 0, variants_updated: 0, images: 0 };
const category_ids = new Map();

async function categoryId(slug) {
  if (!slug) return null;
  if (category_ids.has(slug)) return category_ids.get(slug);
  if (!SLUG.test(slug)) throw new Error(`invalid category handle "${slug}"`);
  const name = titleCase(slug);
  const id = await backend.upsertCategory({
    slug,
    name: Object.fromEntries(LOCALES.map((locale) => [locale, name])),
    sort_order: 0,
  });
  category_ids.set(slug, id);
  return id;
}

async function loadImage(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`image ${source}: HTTP ${response.status}`);
    const name = basename(new URL(source).pathname) || "image.jpg";
    return new File([await response.arrayBuffer()], name, {
      type: response.headers.get("content-type") ?? "image/jpeg",
    });
  }
  // Local paths are relative to the CSV file.
  const path = resolve(dirname(csv_path), source);
  if (!existsSync(path)) throw new Error(`image not found: ${path}`);
  const extension = path.split(".").pop().toLowerCase();
  const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[
    extension
  ];
  if (!type) throw new Error(`unsupported image type: ${path}`);
  return new File([readFileSync(path)], basename(path), { type });
}

for (const [handle, rows] of products) {
  const first = rows[0];
  try {
    if (!SLUG.test(handle)) throw new Error(`invalid handle "${handle}" (lowercase letters, numbers and hyphens)`);
    const title = localized(first, "title");
    if (Object.keys(title).length === 0) throw new Error("needs a title in at least one language");
    const price = toCents(first.price);
    if (price === null) throw new Error("price is required");
    const compare_at_price = toCents(first.compare_at_price) ?? 0;
    if (compare_at_price && compare_at_price <= price) throw new Error("compare_at_price must be higher than price");
    const status = (first.status || "draft").toLowerCase();
    if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(", ")}`);

    // Check every variant row first: a product is imported whole or not at all,
    // so a typo never leaves a product without variants in the store.
    const variant_problems = [];
    for (const row of rows) {
      const sku = row.sku.toUpperCase();
      const stock = Number(row.stock || 0);
      if (!sku) variant_problems.push(`line ${row.line}: sku is required`);
      if (!Number.isInteger(stock) || stock < 0)
        variant_problems.push(`line ${row.line}: invalid stock "${row.stock}"`);
      if (row.color_hex && !/^#[0-9a-fA-F]{6}$/.test(row.color_hex)) {
        variant_problems.push(`line ${row.line}: invalid color_hex "${row.color_hex}"`);
      }
      try {
        toCents(row.variant_price);
      } catch (error) {
        variant_problems.push(`line ${row.line}: ${error.message}`);
      }
    }
    if (variant_problems.length > 0) throw new Error(`product skipped:\n    ${variant_problems.join("\n    ")}`);

    const { id: product_id, is_new } = await backend.upsertProduct({
      slug: handle,
      title,
      description: localized(first, "description", (text) => text.replace(/\\n/g, "\n")),
      category_id: await categoryId(first.category),
      price,
      compare_at_price,
      status,
      is_featured: ["yes", "true", "1"].includes((first.featured ?? "").toLowerCase()),
      tags: (first.tags ?? "")
        .split("|")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    if (is_new) stats.products_created++;
    else stats.products_updated++;
    console.log(`${is_new ? "+" : "~"} ${handle}`);

    // Images only for new products, so re-imports don't duplicate them. PocketBase only.
    const image_sources = (first.image_urls ?? "")
      .split("|")
      .map((source) => source.trim())
      .filter(Boolean);
    if (image_sources.length > 0 && is_new && backend.name === "pocketbase") {
      for (const source of image_sources.slice(0, 10)) {
        try {
          await backend.addProductImage(product_id, await loadImage(source));
          stats.images++;
        } catch (error) {
          errors.push(`line ${first.line} (${handle}): ${error.message}`);
        }
      }
    }

    for (const [index, row] of rows.entries()) {
      try {
        const sku = row.sku.toUpperCase();
        if (!sku) throw new Error("sku is required");
        const stock = Number(row.stock || 0);
        if (!Number.isInteger(stock) || stock < 0) throw new Error(`invalid stock "${row.stock}"`);
        if (row.color_hex && !/^#[0-9a-fA-F]{6}$/.test(row.color_hex))
          throw new Error(`invalid color_hex "${row.color_hex}"`);
        const owner_id = await backend.variantProductId(sku);
        if (owner_id && owner_id !== product_id) throw new Error(`SKU ${sku} belongs to another product`);
        await backend.upsertVariant({
          product_id,
          sku,
          size: row.size ?? "",
          color: row.color ?? "",
          color_hex: row.color_hex ?? "",
          price_override: toCents(row.variant_price) ?? 0,
          stock,
          sort_order: index,
        });
        if (owner_id) stats.variants_updated++;
        else stats.variants_created++;
      } catch (error) {
        errors.push(`line ${row.line} (${handle}): ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`line ${first.line} (${handle}): ${error.response?.message ?? error.message}`);
  }
}

await backend.close();

console.log(
  `\nDone: ${stats.products_created} products created, ${stats.products_updated} updated; ` +
    `${stats.variants_created} variants created, ${stats.variants_updated} updated; ${stats.images} images uploaded.`,
);
if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
