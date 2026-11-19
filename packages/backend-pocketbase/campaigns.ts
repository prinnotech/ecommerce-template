import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { CampaignRecord, CampaignsBackend, SegmentsBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { EmailCampaignsResponse } from "@repo/backend-pocketbase/pocketbase-types";

// Segments, campaigns and deliveries are locked collections: only the server reaches them.

function notFound(error: unknown): never {
  if (pocketBaseStatus(error) === 404) throw new BackendError("not_found");
  throw error;
}

export const segments: SegmentsBackend = {
  async list() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("customer_segments").getFullList({ sort: "name" });
    return records.map((record) => ({ id: record.id, name: record.name, rules: record.rules ?? null }));
  },
  async create(fields) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("customer_segments").create(fields);
    return { id: record.id };
  },
  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("customer_segments").update(id, fields).catch(notFound);
  },
  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("customer_segments").delete(id).catch(notFound);
  },
};

function toRecord(record: EmailCampaignsResponse): CampaignRecord {
  return {
    id: record.id,
    name: record.name,
    segment_id: record.segment_id,
    subject: record.subject ?? {},
    body: record.body ?? {},
    status: record.status,
    recipient_count: record.recipient_count,
    sent_count: record.sent_count,
    failed_count: record.failed_count,
    sent_at: record.sent_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export const campaigns: CampaignsBackend = {
  async list(filters, page_size) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("email_campaigns").getList(filters.page, page_size, {
      sort: "-created_at,id",
      ...(filters.status !== "all" ? { filter: pb.filter("status = {:status}", { status: filters.status }) } : {}),
    });
    return {
      items: result.items.map(toRecord),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },

  async get(id) {
    const pb = await createAdminPocketBase();
    return toRecord(await pb.collection("email_campaigns").getOne(id).catch(notFound));
  },

  async create(fields) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("email_campaigns").create({ ...fields, status: "draft" });
    return { id: record.id };
  },

  async update(id, fields) {
    const pb = await createAdminPocketBase();
    await pb.collection("email_campaigns").update(id, fields).catch(notFound);
  },

  async remove(id) {
    const pb = await createAdminPocketBase();
    await pb.collection("email_campaigns").delete(id).catch(notFound);
  },

  // Batches of 100 requests (PocketBase's batch limit is configurable; 100 stays well under it).
  async startSending(id, recipients) {
    const pb = await createAdminPocketBase();
    await pb.collection("email_campaigns").getOne(id, { fields: "id" }).catch(notFound);
    for (let start = 0; start < recipients.length; start += 100) {
      const batch = pb.createBatch();
      for (const recipient of recipients.slice(start, start + 100)) {
        batch.collection("campaign_deliveries").create({ campaign: id, ...recipient, status: "pending", error: "" });
      }
      await batch.send();
    }
    await pb.collection("email_campaigns").update(id, { status: "sending", recipient_count: recipients.length });
  },

  async pendingDeliveries(campaign_id, limit) {
    const pb = await createAdminPocketBase();
    const result = await pb.collection("campaign_deliveries").getList(1, limit, {
      filter: pb.filter('campaign = {:id} && status = "pending"', { id: campaign_id }),
      sort: "created_at,id",
      fields: "id,user_id,email,name,locale",
      skipTotal: true,
    });
    return result.items.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      email: item.email,
      name: item.name,
      locale: item.locale,
    }));
  },

  async markDelivery(id, status, error) {
    const pb = await createAdminPocketBase();
    await pb.collection("campaign_deliveries").update(id, { status, error: error.slice(0, 500) });
  },

  async refreshCounts(id) {
    const pb = await createAdminPocketBase();
    const count = async (status: string) =>
      (
        await pb.collection("campaign_deliveries").getList(1, 1, {
          filter: pb.filter("campaign = {:id} && status = {:status}", { id, status }),
          fields: "id",
        })
      ).totalItems;
    const [pending, sent, failed] = await Promise.all([count("pending"), count("sent"), count("failed")]);
    const campaign = await pb.collection("email_campaigns").getOne(id, { fields: "status" });
    if (campaign.status === "sending") {
      await pb.collection("email_campaigns").update(id, {
        sent_count: sent,
        failed_count: failed,
        ...(pending === 0 ? { status: "sent", sent_at: new Date().toISOString() } : {}),
      });
    }
    return { pending };
  },

  async sendingIds() {
    const pb = await createAdminPocketBase();
    const records = await pb.collection("email_campaigns").getFullList({ filter: 'status = "sending"', fields: "id" });
    return records.map((record) => record.id);
  },
};
