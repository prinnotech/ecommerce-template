// Backend-neutral seed operations for the CLI scripts (seed, demo, create-admin, import-products).
// Dispatches on BACKEND:
//   pocketbase (default) — PocketBase HTTP API (superuser)
//   sqlite               — a SQLite file (node:sqlite via Kysely)
//   supabase             — Postgres via Kysely + Supabase Auth for creating users
//
// Every write is idempotent: categories/products upsert by slug, variants by SKU, users by email,
// roles by name. No migrations are applied here (the app or `npm run db:setup` does that first).
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { Kysely, PostgresDialect, SqliteDialect } from "kysely";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import PocketBase from "pocketbase";

// ---- Small helpers inlined from backend-sqlite/* so the .mjs scripts stay dependency-free.
//      These MUST match packages/backend-sqlite/passwords.ts (hash format) and config.ts (path).

// Order items keep a plain-text title: English if there is one, else any filled language
// (imported products are often Italian only).
function anyTitle(title) {
  const text = title && typeof title === "object" ? title : {};
  return text.en || Object.values(text).find((value) => typeof value === "string" && value.trim()) || "—";
}

function repoRoot() {
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth++) {
    if (existsSync(path.join(dir, "package-lock.json"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function sqlitePath() {
  return path.resolve(process.env.SQLITE_PATH ?? path.join(repoRoot(), "data", "store.db"));
}

// node:sqlite behind the better-sqlite3 shape Kysely's SqliteDialect expects.
function openSqlite(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  return {
    close: () => db.close(),
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        reader: statement.columns().length > 0,
        all: (parameters) => statement.all(...parameters),
        run: (parameters) => statement.run(...parameters),
        iterate: (parameters) => statement.iterate(...parameters),
      };
    },
  };
}

// scrypt, same format as packages/backend-sqlite/passwords.ts (keep in sync).
const SCRYPT = { N: 32768, r: 8, p: 1, keyLength: 64, maxmem: 64 * 1024 * 1024 };
const scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// ---------- PocketBase ----------

async function pocketbaseBackend() {
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090");
  await pb
    .collection("_superusers")
    .authWithPassword(process.env.POCKETBASE_SUPERUSER_EMAIL ?? "", process.env.POCKETBASE_SUPERUSER_PASSWORD ?? "");

  const first = (collection, filter) =>
    pb
      .collection(collection)
      .getFirstListItem(filter)
      .catch(() => null);

  return {
    name: "pocketbase",
    // Autodate fields (created_at) can't be set through the API.
    can_backdate: false,

    async upsertCategory({ slug, name, sort_order = 0 }) {
      const existing = await first("categories", pb.filter("slug = {:slug}", { slug }));
      if (existing) return existing.id;
      return (await pb.collection("categories").create({ slug, name, sort_order, is_active: true })).id;
    },

    async upsertProduct({
      slug,
      title,
      description = {},
      category_id,
      price,
      compare_at_price = 0,
      status = "active",
      is_featured = false,
      tags = [],
    }) {
      const existing = await first("products", pb.filter("slug = {:slug}", { slug }));
      if (existing) return { id: existing.id, is_new: false };
      const record = await pb.collection("products").create({
        slug,
        title,
        description,
        category: category_id,
        price,
        compare_at_price,
        status,
        is_featured,
        tags,
      });
      return { id: record.id, is_new: true };
    },

    async upsertVariant({
      product_id,
      sku,
      size = "",
      color = "",
      color_hex = "",
      price_override = 0,
      stock = 0,
      sort_order = 0,
    }) {
      const existing = await first("product_variants", pb.filter("sku = {:sku}", { sku }));
      if (existing) {
        await pb
          .collection("product_variants")
          .update(existing.id, { size, color, color_hex, price_override, stock, sort_order });
        return existing.id;
      }
      return (
        await pb.collection("product_variants").create({
          product: product_id,
          sku,
          size,
          color,
          color_hex,
          price_override,
          stock,
          is_active: true,
          sort_order,
        })
      ).id;
    },

    async variantProductId(sku) {
      const row = await first("product_variants", pb.filter("sku = {:sku}", { sku }));
      return row?.product ?? null;
    },

    async addProductImage(product_id, file) {
      await pb.collection("products").update(product_id, { "images+": file });
    },

    async createUser({ email, password, name, verified = true, accepts_marketing = false }) {
      const existing = await first("users", pb.filter("email = {:email}", { email }));
      if (existing) return { id: existing.id, is_new: false };
      const user = await pb
        .collection("users")
        .create({ email, password, passwordConfirm: password, name, verified, accepts_marketing });
      return { id: user.id, is_new: true };
    },

    async setTeamMember({ user_id, roles, is_admin = false, is_active = true }) {
      const member = await first("team_members", pb.filter("user = {:user}", { user: user_id }));
      const access = { roles, is_admin, is_active };
      if (member) await pb.collection("team_members").update(member.id, access);
      else await pb.collection("team_members").create({ user: user_id, ...access });
    },

    async upsertRole({ name, description = "", permissions = [], is_system = false, is_read_only = false }) {
      const existing = await first("roles", pb.filter("name = {:name}", { name }));
      if (existing) return;
      await pb.collection("roles").create({ name, description, permissions, is_system, is_read_only });
    },

    async listProducts() {
      const rows = await pb.collection("products").getFullList({ fields: "id,title,price", sort: "created_at" });
      return rows.map((row) => ({ id: row.id, title: anyTitle(row.title), price: row.price }));
    },

    async listVariants() {
      const rows = await pb.collection("product_variants").getFullList({ fields: "id,product,color,size,sku" });
      return rows.map((row) => ({
        id: row.id,
        product_id: row.product,
        color: row.color,
        size: row.size,
        sku: row.sku,
      }));
    },

    async nextOrderNumber() {
      const last = await pb
        .collection("orders")
        .getFullList({ fields: "order_number", sort: "-order_number", perPage: 1 });
      return (last[0]?.order_number ?? 1000) + 1;
    },

    async createOrder(order) {
      // created_at is an autodate field: PocketBase sets it, so it isn't sent.
      const { item, payment, events, user_id, created_at: _created_at, ...fields } = order;
      const { product_id, variant_id, ...item_fields } = item;
      const created = await pb.collection("orders").create({ ...fields, user: user_id });
      await pb
        .collection("order_items")
        .create({ ...item_fields, order: created.id, product: product_id, variant: variant_id });
      if (payment) await pb.collection("payments").create({ ...payment, order: created.id });
      for (const event of events) await pb.collection("order_events").create({ ...event, order: created.id });
    },

    // The demo's theme library: replaces every theme. `{}` data = the template's defaults.
    async replaceThemes(themes) {
      for (const theme of await pb.collection("themes").getFullList({ fields: "id" })) {
        await pb.collection("themes").delete(theme.id);
      }
      for (const theme of themes) await pb.collection("themes").create(theme);
    },

    async upsertPage(page) {
      const existing = await first("pages", pb.filter("slug = {:slug}", { slug: page.slug }));
      if (existing) await pb.collection("pages").update(existing.id, page);
      else await pb.collection("pages").create(page);
    },

    async saveSetting({ key, category, value, is_public }) {
      const existing = await first("site_settings", pb.filter("key = {:key}", { key }));
      const fields = { key, category, value, is_public, description: "" };
      if (existing) await pb.collection("site_settings").update(existing.id, fields);
      else await pb.collection("site_settings").create(fields);
    },

    async createMessage(message) {
      await pb.collection("contact_messages").create(message);
    },

    async clearDemoData() {
      const orders = await pb.collection("orders").getFullList({ fields: "id" });
      for (const order of orders) {
        const filter = pb.filter("order = {:id}", { id: order.id });
        const [items, payments, events] = await Promise.all([
          pb.collection("order_items").getFullList({ filter, fields: "id" }),
          pb.collection("payments").getFullList({ filter, fields: "id" }),
          pb.collection("order_events").getFullList({ filter, fields: "id" }),
        ]);
        await Promise.all([
          ...items.map((row) => pb.collection("order_items").delete(row.id)),
          ...payments.map((row) => pb.collection("payments").delete(row.id)),
          ...events.map((row) => pb.collection("order_events").delete(row.id)),
        ]);
        await pb.collection("orders").delete(order.id);
      }
      for (const message of await pb.collection("contact_messages").getFullList({ fields: "id" })) {
        await pb.collection("contact_messages").delete(message.id);
      }
    },

    async close() {},
  };
}

// ---------- SQL (SQLite + Supabase) ----------

function sqlBackend(db, dialect, supabase_admin) {
  // SQLite stores booleans as 0/1 and JSON as text; Postgres uses true/false. JSON is kept as
  // text in both (the app maps it through json() on read), so only booleans differ here.
  const bool = (value) => (dialect === "sqlite" ? (value ? 1 : 0) : value);
  const json = (value) => JSON.stringify(value ?? {});
  const parseJson = (value) => (typeof value === "string" ? JSON.parse(value || "{}") : (value ?? {}));

  async function findId(table, column, value) {
    const row = await db.selectFrom(table).select("id").where(column, "=", value).executeTakeFirst();
    return row?.id;
  }

  return {
    name: dialect,
    can_backdate: true,

    async upsertCategory({ slug, name, sort_order = 0 }) {
      const id = await findId("categories", "slug", slug);
      if (id) return id;
      const new_id = randomUUID();
      await db
        .insertInto("categories")
        .values({
          id: new_id,
          slug,
          name: json(name),
          description: json({}),
          parent_id: null,
          image: "",
          sort_order,
          is_active: bool(true),
        })
        .execute();
      return new_id;
    },

    async upsertProduct({
      slug,
      title,
      description = {},
      category_id,
      price,
      compare_at_price = 0,
      status = "active",
      is_featured = false,
      tags = [],
    }) {
      const id = await findId("products", "slug", slug);
      if (id) return { id, is_new: false };
      const new_id = randomUUID();
      await db
        .insertInto("products")
        .values({
          id: new_id,
          slug,
          title: json(title),
          description: json(description),
          category_id: category_id ?? null,
          price,
          compare_at_price,
          status,
          is_featured: bool(is_featured),
          tags: json(tags),
          deleted_at: null,
        })
        .execute();
      return { id: new_id, is_new: true };
    },

    async upsertVariant({
      product_id,
      sku,
      size = "",
      color = "",
      color_hex = "",
      price_override = 0,
      stock = 0,
      sort_order = 0,
    }) {
      const existing = await db.selectFrom("product_variants").select("id").where("sku", "=", sku).executeTakeFirst();
      if (existing) {
        await db
          .updateTable("product_variants")
          .set({ size, color, color_hex, price_override, stock, sort_order })
          .where("id", "=", existing.id)
          .execute();
        return existing.id;
      }
      const new_id = randomUUID();
      await db
        .insertInto("product_variants")
        .values({
          id: new_id,
          product_id,
          sku,
          size,
          color,
          color_hex,
          price_override,
          stock,
          is_active: bool(true),
          sort_order,
        })
        .execute();
      return new_id;
    },

    async variantProductId(sku) {
      const row = await db
        .selectFrom("product_variants")
        .select("product_id")
        .where("sku", "=", sku)
        .executeTakeFirst();
      return row?.product_id ?? null;
    },

    // Image upload from the CLI isn't implemented for SQL backends; images are added in the admin.
    async addProductImage() {},

    async createUser({ email, password, name, verified = true, accepts_marketing = false }) {
      const existing = await db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
      if (existing) return { id: existing.id, is_new: false };

      if (dialect === "supabase") {
        // Supabase Auth creates the public.users row via the migration's trigger.
        const created = await supabase_admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        });
        if (created.error && created.error.code !== "email_exists") throw created.error;
        const row = await db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
        if (!row) throw new Error(`No users row for ${email}: is the auth trigger installed?`);
        return { id: row.id, is_new: true };
      }

      const new_id = randomUUID();
      await db
        .insertInto("users")
        .values({
          id: new_id,
          email,
          name,
          phone: "",
          verified: bool(verified),
          accepts_marketing: bool(accepts_marketing),
        })
        .execute();
      await db
        .insertInto("auth_credentials")
        .values({ user_id: new_id, password_hash: await hashPassword(password) })
        .execute();
      return { id: new_id, is_new: true };
    },

    async setTeamMember({ user_id, roles, is_admin = false, is_active = true }) {
      const existing = await db
        .selectFrom("team_members")
        .select("id")
        .where("user_id", "=", user_id)
        .executeTakeFirst();
      if (existing) {
        await db
          .updateTable("team_members")
          .set({ roles: json(roles), is_admin: bool(is_admin), is_active: bool(is_active) })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("team_members")
          .values({
            id: randomUUID(),
            user_id,
            roles: json(roles),
            is_admin: bool(is_admin),
            is_active: bool(is_active),
            locale: "",
          })
          .execute();
      }
    },

    async upsertRole({ name, description = "", permissions = [], is_system = false, is_read_only = false }) {
      const existing = await db.selectFrom("roles").select("id").where("name", "=", name).executeTakeFirst();
      if (existing) return;
      await db
        .insertInto("roles")
        .values({
          id: randomUUID(),
          name,
          description,
          permissions: json(permissions),
          is_system: bool(is_system),
          is_read_only: bool(is_read_only),
        })
        .execute();
    },

    async listProducts() {
      const rows = await db
        .selectFrom("products")
        .select(["id", "title", "price"])
        .where("deleted_at", "is", null)
        .orderBy("created_at", "asc")
        .execute();
      return rows.map((row) => ({ id: row.id, title: anyTitle(parseJson(row.title)), price: row.price }));
    },

    async listVariants() {
      const rows = await db
        .selectFrom("product_variants")
        .select(["id", "product_id", "color", "size", "sku"])
        .execute();
      return rows.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        color: row.color,
        size: row.size,
        sku: row.sku,
      }));
    },

    async nextOrderNumber() {
      const row = await db
        .selectFrom("orders")
        .select("order_number")
        .orderBy("order_number", "desc")
        .limit(1)
        .executeTakeFirst();
      return (row?.order_number ?? 1000) + 1;
    },

    async createOrder(order) {
      const { item, payment, events, user_id, ...rest } = order;
      const order_id = randomUUID();
      await db
        .insertInto("orders")
        .values({
          id: order_id,
          created_at: rest.created_at ?? new Date().toISOString(),
          order_number: rest.order_number,
          user_id: user_id ?? null,
          email: rest.email,
          phone: rest.phone ?? "",
          locale: rest.locale ?? "en",
          status: rest.status,
          payment_status: rest.payment_status,
          payment_method: rest.payment_method,
          currency: rest.currency,
          subtotal: rest.subtotal,
          discount_total: rest.discount_total,
          shipping_total: rest.shipping_total,
          tax_total: rest.tax_total,
          cod_fee: rest.cod_fee,
          total: rest.total,
          discount_code_id: null,
          shipping_address: json(rest.shipping_address),
          billing_address: json(rest.billing_address),
          shipping_method: rest.shipping_method,
          customer_note: "",
          internal_note: "",
          attribution: json({}),
          tracking_number: "",
          carrier: "",
          tracking_url: "",
          checkout_session_id: null,
          paid_at: rest.paid_at ?? null,
          shipped_at: rest.shipped_at ?? null,
          delivered_at: rest.delivered_at ?? null,
          cancelled_at: rest.cancelled_at ?? null,
          deleted_at: null,
        })
        .execute();

      await db
        .insertInto("order_items")
        .values({
          id: randomUUID(),
          order_id,
          product_id: item.product_id ?? null,
          variant_id: item.variant_id ?? null,
          title: item.title,
          variant_label: item.variant_label ?? "",
          sku: item.sku ?? "",
          image: item.image ?? "",
          unit_price: item.unit_price,
          quantity: item.quantity,
          line_total: item.line_total,
        })
        .execute();

      if (payment) {
        await db
          .insertInto("payments")
          .values({
            id: randomUUID(),
            order_id,
            checkout_session_id: null,
            provider: payment.provider,
            provider_ref: "",
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            error_code: "",
            raw: json({}),
          })
          .execute();
      }

      for (const event of events) {
        await db
          .insertInto("order_events")
          .values({
            id: randomUUID(),
            order_id,
            type: event.type,
            from_status: event.from_status,
            to_status: event.to_status,
            message: event.message ?? "",
            actor_id: null,
            is_customer_visible: bool(event.is_customer_visible ?? true),
          })
          .execute();
      }
    },

    async replaceThemes(themes) {
      await db.deleteFrom("themes").execute();
      for (const theme of themes) {
        await db
          .insertInto("themes")
          .values({
            id: randomUUID(),
            name: theme.name,
            template: theme.template,
            draft: json(theme.draft),
            published: theme.published === null ? null : json(theme.published),
            history: JSON.stringify(theme.history ?? []),
            is_live: bool(theme.is_live),
            published_at: theme.published_at || null,
          })
          .execute();
      }
    },

    async upsertPage(page) {
      const values = {
        title: json(page.title),
        sections: JSON.stringify(page.sections),
        seo: json(page.seo),
        is_published: bool(page.is_published),
      };
      const id = await findId("pages", "slug", page.slug);
      if (id) await db.updateTable("pages").set(values).where("id", "=", id).execute();
      else
        await db
          .insertInto("pages")
          .values({ id: randomUUID(), slug: page.slug, ...values })
          .execute();
    },

    async saveSetting({ key, category, value, is_public }) {
      const values = { category, value: JSON.stringify(value), is_public: bool(is_public), description: "" };
      const existing = await db.selectFrom("site_settings").select("key").where("key", "=", key).executeTakeFirst();
      if (existing) await db.updateTable("site_settings").set(values).where("key", "=", key).execute();
      else
        await db
          .insertInto("site_settings")
          .values({ id: randomUUID(), key, ...values })
          .execute();
    },

    async createMessage(message) {
      await db
        .insertInto("contact_messages")
        .values({
          id: randomUUID(),
          name: message.name,
          email: message.email,
          phone: message.phone ?? "",
          subject: message.subject ?? "",
          message: message.message,
          status: message.status ?? "new",
        })
        .execute();
    },

    async clearDemoData() {
      const order_ids = (await db.selectFrom("orders").select("id").execute()).map((row) => row.id);
      if (order_ids.length > 0) {
        await db.deleteFrom("order_items").where("order_id", "in", order_ids).execute();
        await db.deleteFrom("payments").where("order_id", "in", order_ids).execute();
        await db.deleteFrom("order_events").where("order_id", "in", order_ids).execute();
        await db.deleteFrom("orders").where("id", "in", order_ids).execute();
      }
      await db.deleteFrom("contact_messages").execute();
    },

    async close() {
      await db.destroy();
    },
  };
}

// ---------- Factory ----------

export async function getSeedBackend() {
  const backend = process.env.BACKEND ?? "pocketbase";
  if (backend === "pocketbase") return pocketbaseBackend();
  if (backend === "sqlite") {
    const db = new Kysely({ dialect: new SqliteDialect({ database: openSqlite(sqlitePath()) }) });
    return sqlBackend(db, "sqlite", null);
  }
  if (backend === "supabase") {
    const connection_string = process.env.DATABASE_URL;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!connection_string || !url || !secret) {
      throw new Error("Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for BACKEND=supabase.");
    }
    const db = new Kysely({
      dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: connection_string, max: 1 }) }),
    });
    const admin = createClient(url, secret, { auth: { persistSession: false } }).auth.admin;
    return sqlBackend(db, "supabase", admin);
  }
  throw new Error(`Unknown BACKEND=${backend}. Use "pocketbase", "sqlite" or "supabase".`);
}
