// Sets up a SQL backend: applies the migrations and creates the store owner's admin account.
// Usage: npm run db:setup   (reads BACKEND and the database variables from .env.local)
//   BACKEND=supabase  DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
//   BACKEND=sqlite    SQLITE_PATH (optional, default data/store.db)
//   STORE_ADMIN_EMAIL / STORE_ADMIN_PASSWORD (8+ chars): the owner's dashboard login (optional)
// Safe to run again: applied migrations and existing accounts are skipped.
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { Kysely, PostgresDialect, SqliteDialect, sql } from "kysely";
import pg from "pg";

import { migrate } from "../packages/backend-sql/migrations.ts";
import { sqlitePath } from "../packages/backend-sqlite/config.ts";
import { openSqlite } from "../packages/backend-sqlite/driver.ts";
import { hashPassword } from "../packages/backend-sqlite/passwords.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const backend = process.env.BACKEND ?? "";

async function setupSupabase() {
  const connection_string = process.env.DATABASE_URL;
  const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!connection_string || !supabase_url || !secret) {
    throw new Error("Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  }

  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: connection_string, max: 1 }) }),
  });
  try {
    const applied = await migrate(db, { dialect: "postgres", supabase: true });
    console.log(applied.length > 0 ? `Applied: ${applied.join(", ")}` : "Database is up to date.");

    const email = (process.env.STORE_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.STORE_ADMIN_PASSWORD ?? "";
    if (!email || password.length < 8) {
      console.log("STORE_ADMIN_EMAIL / STORE_ADMIN_PASSWORD (8+ chars) not set: no admin account created.");
      return;
    }

    // The auth trigger (migration 0002_supabase) creates the public.users row.
    const admin = createClient(supabase_url, secret, { auth: { persistSession: false } }).auth.admin;
    const created = await admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Store admin" },
    });
    if (created.error && created.error.code !== "email_exists") throw created.error;
    console.log(created.error ? `Admin account ${email} already exists.` : `Created admin account ${email}.`);

    const user = await sql<{ id: string }>`select id from users where email = ${email}`.execute(db);
    const user_id = user.rows[0]?.id;
    if (!user_id) throw new Error(`No users row for ${email}: is the auth trigger installed?`);
    await sql`
      insert into team_members (id, user_id, roles, is_admin, is_active)
      values (${randomUUID()}, ${user_id}, ${'["admin"]'}, true, true)
      on conflict (user_id) do update set is_admin = true, is_active = true`.execute(db);
    console.log(`${email} has admin access to the dashboard.`);
  } finally {
    await db.destroy();
  }
}

async function setupSqlite() {
  const file = sqlitePath();
  const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: openSqlite(file) }) });
  try {
    const applied = await migrate(db, { dialect: "sqlite", supabase: false });
    console.log(`${file}: ${applied.length > 0 ? `applied ${applied.join(", ")}` : "up to date"}.`);

    const email = (process.env.STORE_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.STORE_ADMIN_PASSWORD ?? "";
    if (!email || password.length < 8) {
      console.log("STORE_ADMIN_EMAIL / STORE_ADMIN_PASSWORD (8+ chars) not set: no admin account created.");
      return;
    }

    const existing = await sql<{ id: string }>`select id from users where email = ${email}`.execute(db);
    let user_id = existing.rows[0]?.id;
    if (user_id) console.log(`Admin account ${email} already exists.`);
    else {
      user_id = randomUUID();
      await sql`insert into users (id, email, name, verified) values (${user_id}, ${email}, ${"Store admin"}, 1)`.execute(
        db,
      );
      await sql`insert into auth_credentials (user_id, password_hash) values (${user_id}, ${await hashPassword(password)})`.execute(
        db,
      );
      console.log(`Created admin account ${email}.`);
    }
    await sql`
      insert into team_members (id, user_id, roles, is_admin, is_active)
      values (${randomUUID()}, ${user_id}, ${'["admin"]'}, 1, 1)
      on conflict (user_id) do update set is_admin = 1, is_active = 1`.execute(db);
    console.log(`${email} has admin access to the dashboard.`);
  } finally {
    await db.destroy();
  }
}

if (backend === "supabase") await setupSupabase();
else if (backend === "sqlite") await setupSqlite();
else {
  console.error(
    `npm run db:setup needs BACKEND=supabase or BACKEND=sqlite (PocketBase sets itself up). BACKEND is "${backend || "not set"}".`,
  );
  process.exit(1);
}
