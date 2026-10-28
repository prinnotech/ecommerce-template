import PocketBase from "pocketbase";

import { POCKETBASE_URL } from "@/lib/site-config";
import type { TypedPocketBase } from "@/types/pocketbase-types";

let browser_client: TypedPocketBase | null = null;

// Browser client for realtime subscriptions and public reads only.
// It never holds the auth token: that stays in the httpOnly pb_auth cookie.
export function createBrowserPocketBase(): TypedPocketBase {
  browser_client ??= new PocketBase(POCKETBASE_URL) as TypedPocketBase;
  return browser_client;
}
