import { timingSafeEqual } from "node:crypto";

import { processSendingCampaigns } from "@repo/core/lib/campaigns-server";
import { reportError } from "@repo/core/lib/server-log";

// Called by the host's cron (every 5–15 minutes) with "Authorization: Bearer <CRON_SECRET>"
// (Vercel Cron sends it on its own). Sends the next batch of every campaign still going out.
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await processSendingCampaigns());
  } catch (error) {
    await reportError("cron", "campaigns", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
