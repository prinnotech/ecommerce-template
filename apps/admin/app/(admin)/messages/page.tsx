import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { MessagesInbox } from "./components/messages-inbox";
import { getMessages } from "@repo/core/actions/contact";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { unwrap } from "@repo/core/lib/action-result";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { message_filters_schema } from "@repo/core/lib/schemas/contact";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.messages.meta_title);
}

export default async function DashboardMessagesPage({ searchParams }: PageProps<"/messages">) {
  const lang = await getAdminLocale();
  await requirePermission("messages.view");
  const filters = message_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getAdminDictionary(lang),
    query_client.prefetchQuery({
      queryKey: query_keys.messages(filters),
      queryFn: async () => unwrap(await getMessages(filters)),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <MessagesInbox
          lang={lang}
          dictionary={dictionary.messages}
          index_table={dictionary.admin_ui.index_table}
          common={dictionary.common}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
