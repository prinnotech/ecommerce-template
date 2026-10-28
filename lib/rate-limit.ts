import "server-only";

import { headers } from "next/headers";

// In-memory sliding window, per server instance. Good enough to slow down brute force on
// one instance; a multi-instance deploy should move this to a shared store.
const buckets = new Map<string, number[]>();

export async function getClientIp(): Promise<string> {
  const header_list = await headers();
  return header_list.get("x-forwarded-for")?.split(",")[0]?.trim() || header_list.get("x-real-ip")?.trim() || "unknown";
}

// Records a hit and returns true when `key` has more than `limit` hits within `window_ms`.
export function isRateLimited(key: string, limit: number, window_ms: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < window_ms);
  hits.push(now);
  buckets.set(key, hits);

  // Keep the map from growing forever on a long-lived instance.
  if (buckets.size > 10_000) {
    for (const [bucket_key, bucket_hits] of buckets) {
      if (bucket_hits.every((time) => now - time >= window_ms)) buckets.delete(bucket_key);
    }
  }

  return hits.length > limit;
}
