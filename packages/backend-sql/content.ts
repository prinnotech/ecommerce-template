import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { ActivityBackend, InboxMessage, MessagesBackend, SettingsBackend } from "@repo/core/backend/types";
import type { MessageStatus } from "@repo/core/lib/schemas/contact";
import { contains, paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

export function createActivity(ctx: SqlContext): ActivityBackend {
  const { db } = ctx;
  return {
    async log(entry) {
      await db
        .insertInto("activity_log")
        .values({
          id: newId(),
          actor_id: entry.actor_id,
          action: entry.action,
          target_type: entry.target_type ?? "",
          target_id: entry.target_id ?? "",
          details: entry.details ?? null,
          is_denied: entry.is_denied ?? false,
        })
        .execute();
    },

    async list(filters, page_size) {
      const base = db
        .selectFrom("activity_log")
        .leftJoin("users", "users.id", "activity_log.actor_id")
        .$if(filters.result === "denied", (query) => query.where("activity_log.is_denied", "=", true))
        .$if(Boolean(filters.search), (query) =>
          query.where((eb) =>
            eb.or([
              contains(ctx, "activity_log.action", filters.search),
              contains(ctx, "users.email", filters.search),
              contains(ctx, "users.name", filters.search),
            ]),
          ),
        );
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await base.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await base
              .select([
                "activity_log.id",
                "activity_log.created_at",
                "activity_log.actor_id",
                "users.name as actor_name",
                "users.email as actor_email",
                "activity_log.action",
                "activity_log.target_type",
                "activity_log.target_id",
                "activity_log.details",
                "activity_log.is_denied",
              ])
              .orderBy("activity_log.created_at", "desc")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map((row) => ({
            id: row.id,
            created_at: iso(row.created_at),
            actor_id: row.actor_id ?? "",
            actor_name: row.actor_name ?? "",
            actor_email: row.actor_email ?? "",
            action: row.action,
            target_type: row.target_type,
            target_id: row.target_id,
            details: json<Record<string, unknown> | null>(row.details, null),
            is_denied: bool(row.is_denied),
          })),
      );
    },
  };
}

export function createSettings({ db, storage }: SqlContext): SettingsBackend {
  async function find(key: string) {
    return db
      .selectFrom("site_settings")
      .select(["id", "key", "value", "updated_at"])
      .where("key", "=", key)
      .executeTakeFirst();
  }

  return {
    async list() {
      const rows = await db.selectFrom("site_settings").select(["key", "value", "updated_at"]).execute();
      return rows.map((row) => ({
        key: row.key,
        value: json<unknown>(row.value, null),
        updated_at: iso(row.updated_at),
      }));
    },

    async get(key) {
      const row = await find(key);
      return row ? { key: row.key, value: json<unknown>(row.value, null), updated_at: iso(row.updated_at) } : null;
    },

    async save(row) {
      const existing = await find(row.key);
      if (existing) {
        await db
          .updateTable("site_settings")
          .set({
            category: row.category,
            value: row.value,
            is_public: row.is_public,
            updated_by: row.updated_by,
            updated_at: nowIso(),
          })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("site_settings")
          .values({ id: newId(), ...row })
          .execute();
      }
      return existing ? json<unknown>(existing.value, null) : null;
    },

    async remove(key) {
      const existing = await find(key);
      if (!existing) return undefined;
      await db.deleteFrom("site_settings").where("id", "=", existing.id).execute();
      return json<unknown>(existing.value, null);
    },

    // The store sends its own emails (or Supabase does with its own templates): nothing to sync.
    async syncStoreName() {},

    // The previous file stays: the setting may still point at it until the new URL is saved.
    async uploadAsset(kind, file) {
      return storage.url(await storage.upload(`site/${kind}`, file));
    },
  };
}

function toMessage(row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}): InboxMessage {
  return { ...row, status: row.status as MessageStatus, created_at: iso(row.created_at) };
}

export function createMessages({ db }: SqlContext): MessagesBackend {
  return {
    async create(message) {
      await db
        .insertInto("contact_messages")
        .values({ id: newId(), ...message, status: "new" })
        .execute();
    },

    async list(filters, page_size) {
      const base = db
        .selectFrom("contact_messages")
        .$if(filters.status === "inbox", (query) => query.where("status", "!=", "archived"))
        .$if(filters.status !== "inbox", (query) => query.where("status", "=", filters.status));
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await base.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await base
              .select(["id", "name", "email", "phone", "subject", "message", "status", "created_at"])
              .orderBy("created_at", "desc")
              .offset(offset)
              .limit(limit)
              .execute()
          ).map(toMessage),
      );
    },

    async setStatus(id, status) {
      const result = await db
        .updateTable("contact_messages")
        .set({ status, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async setStatusMany(ids, status) {
      const result = await db
        .updateTable("contact_messages")
        .set({ status, updated_at: nowIso() })
        .where("id", "in", ids)
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    },

    async countUnread() {
      return toCount(
        await db
          .selectFrom("contact_messages")
          .select((eb) => eb.fn.countAll().as("count"))
          .where("status", "=", "new")
          .executeTakeFirst(),
      );
    },
  };
}
