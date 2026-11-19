import "server-only";

import type { Selectable } from "kysely";

import { BackendError } from "@repo/core/backend/errors";
import type { CampaignRecord, CampaignsBackend, SegmentsBackend } from "@repo/core/backend/types";
import { paginate, toCount, type SqlContext } from "@repo/backend-sql/context";
import type { EmailCampaignsTable } from "@repo/backend-sql/schema";
import { iso, json, newId, nowIso } from "@repo/backend-sql/values";

export function createSegments({ db }: SqlContext): SegmentsBackend {
  return {
    async list() {
      const rows = await db.selectFrom("customer_segments").selectAll().orderBy("name").execute();
      return rows.map((row) => ({ id: row.id, name: row.name, rules: json(row.rules, null) }));
    },
    async create(fields) {
      const id = newId();
      await db
        .insertInto("customer_segments")
        .values({ id, ...fields })
        .execute();
      return { id };
    },
    async update(id, fields) {
      const result = await db
        .updateTable("customer_segments")
        .set({ ...fields, updated_at: nowIso() })
        .where("id", "=", id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },
    async remove(id) {
      const result = await db.deleteFrom("customer_segments").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },
  };
}

function toRecord(row: Selectable<EmailCampaignsTable>): CampaignRecord {
  return {
    id: row.id,
    name: row.name,
    segment_id: row.segment_id,
    subject: json(row.subject, {}),
    body: json(row.body, {}),
    status: row.status,
    recipient_count: Number(row.recipient_count),
    sent_count: Number(row.sent_count),
    failed_count: Number(row.failed_count),
    sent_at: iso(row.sent_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function createCampaigns({ db }: SqlContext): CampaignsBackend {
  async function row(id: string) {
    const found = await db.selectFrom("email_campaigns").selectAll().where("id", "=", id).executeTakeFirst();
    if (!found) throw new BackendError("not_found");
    return found;
  }

  return {
    async list(filters, page_size) {
      let query = db.selectFrom("email_campaigns");
      if (filters.status !== "all") query = query.where("status", "=", filters.status);
      return paginate(
        filters.page,
        page_size,
        async () => toCount(await query.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()),
        async (offset, limit) =>
          (
            await query.selectAll().orderBy("created_at", "desc").orderBy("id").offset(offset).limit(limit).execute()
          ).map(toRecord),
      );
    },

    async get(id) {
      return toRecord(await row(id));
    },

    async create(fields) {
      const id = newId();
      await db
        .insertInto("email_campaigns")
        .values({ id, ...fields, status: "draft" })
        .execute();
      return { id };
    },

    async update(id, fields) {
      await row(id);
      await db
        .updateTable("email_campaigns")
        .set({ ...fields, updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
    },

    async remove(id) {
      const result = await db.deleteFrom("email_campaigns").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },

    async startSending(id, recipients) {
      await row(id);
      await db.transaction().execute(async (trx) => {
        // In chunks: SQLite limits the number of values in one statement.
        for (let start = 0; start < recipients.length; start += 200) {
          const chunk = recipients.slice(start, start + 200);
          await trx
            .insertInto("campaign_deliveries")
            .values(chunk.map((recipient) => ({ id: newId(), campaign_id: id, ...recipient, status: "pending" })))
            .onConflict((conflict) => conflict.columns(["campaign_id", "email"]).doNothing())
            .execute();
        }
        await trx
          .updateTable("email_campaigns")
          .set({ status: "sending", recipient_count: recipients.length, updated_at: nowIso() })
          .where("id", "=", id)
          .execute();
      });
    },

    async pendingDeliveries(campaign_id, limit) {
      const rows = await db
        .selectFrom("campaign_deliveries")
        .select(["id", "user_id", "email", "name", "locale"])
        .where("campaign_id", "=", campaign_id)
        .where("status", "=", "pending")
        .orderBy("created_at")
        .orderBy("id")
        .limit(limit)
        .execute();
      return rows;
    },

    async markDelivery(id, status, error) {
      await db
        .updateTable("campaign_deliveries")
        .set({ status, error: error.slice(0, 500), updated_at: nowIso() })
        .where("id", "=", id)
        .execute();
    },

    async refreshCounts(id) {
      const rows = await db
        .selectFrom("campaign_deliveries")
        .select((eb) => ["status", eb.fn.countAll().as("count")])
        .where("campaign_id", "=", id)
        .groupBy("status")
        .execute();
      const count = (status: string) => Number(rows.find((item) => item.status === status)?.count ?? 0);
      const pending = count("pending");
      await db
        .updateTable("email_campaigns")
        .set({
          sent_count: count("sent"),
          failed_count: count("failed"),
          ...(pending === 0 ? { status: "sent", sent_at: nowIso() } : {}),
          updated_at: nowIso(),
        })
        .where("id", "=", id)
        .where("status", "=", "sending")
        .execute();
      return { pending };
    },

    async sendingIds() {
      const rows = await db.selectFrom("email_campaigns").select("id").where("status", "=", "sending").execute();
      return rows.map((item) => item.id);
    },
  };
}
