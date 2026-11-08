import { timingSafeEqual } from "node:crypto";

import { sendDueRecoveryEmails } from "@repo/core/lib/abandoned-checkouts";
import { reportError } from "@repo/core/lib/server-log";

// Called by the host's cron (every 15–60 minutes) with "Authorization: Bearer <CRON_SECRET>"
// (Vercel Cron sends it on its own). Sends the automatic abandoned-checkout emails.
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
    return Response.json(await sendDueRecoveryEmails());
  } catch (error) {
    await reportError("cron", "abandoned-checkouts", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
