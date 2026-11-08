import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { ApiKeysScreen } from "./components/api-keys-screen";
import { getApiKeys } from "@repo/core/actions/api-keys";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.api_keys.title);
}

// The admin's own address, for the MCP endpoint shown on the screen: NEXT_PUBLIC_ADMIN_URL, else the
// address this page was opened at (SITE_URL is the store, not the admin).
async function adminUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_ADMIN_URL) return process.env.NEXT_PUBLIC_ADMIN_URL.replace(/\/$/, "");
  const header_list = await headers();
  const host = header_list.get("x-forwarded-host") ?? header_list.get("host");
  if (!host) return "";
  const protocol = header_list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export default async function ApiKeysPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("api_keys.view");
  const [dictionary, keys, admin_url] = await Promise.all([getAdminDictionary(lang), getApiKeys(), adminUrl()]);
  const query_client = new QueryClient();
  if (keys.ok) query_client.setQueryData(query_keys.api_keys, keys.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <ApiKeysScreen
        lang={lang}
        endpoint={`${admin_url}/api/mcp`}
        can_edit={callerShows(caller, "api_keys.edit") && !caller.is_read_only}
        dictionary={dictionary.api_keys}
        common={dictionary.common}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
