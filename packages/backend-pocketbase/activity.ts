import "server-only";

import { z } from "zod";

import type { ActivityBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";

const details_schema = z.record(z.string(), z.unknown()).nullable().catch(null);

export const activity: ActivityBackend = {
  async log(entry) {
    const pb = await createAdminPocketBase();
    await pb.collection("activity_log").create({
      actor: entry.actor_id ?? "",
      action: entry.action,
      target_type: entry.target_type ?? "",
      target_id: entry.target_id ?? "",
      details: entry.details ?? null,
      is_denied: entry.is_denied ?? false,
    });
  },

  async list(filters, page_size) {
    const pb = await createAdminPocketBase();
    const parts: string[] = [];
    if (filters.result === "denied") parts.push("is_denied = true");
    if (filters.search) {
      parts.push(
        pb.filter("(action ~ {:search} || actor.email ~ {:search} || actor.name ~ {:search})", {
          search: filters.search,
        }),
      );
    }
    const result = await pb.collection("activity_log").getList<{
      id: string;
      created_at: string;
      actor: string;
      action: string;
      target_type: string;
      target_id: string;
      details: unknown;
      is_denied: boolean;
      expand?: { actor?: { email: string; name: string } };
    }>(filters.page, page_size, {
      filter: parts.join(" && "),
      sort: "-created_at,id",
      expand: "actor",
    });
    return {
      items: result.items.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        actor_id: row.actor,
        actor_name: row.expand?.actor?.name ?? "",
        actor_email: row.expand?.actor?.email ?? "",
        action: row.action,
        target_type: row.target_type,
        target_id: row.target_id,
        details: details_schema.parse(row.details),
        is_denied: row.is_denied,
      })),
      page: result.page,
      total_pages: result.totalPages,
      total_items: result.totalItems,
    };
  },
};
