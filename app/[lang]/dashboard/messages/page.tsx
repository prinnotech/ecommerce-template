import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { MessagesInbox } from "./components/messages-inbox";
import { getMessages } from "@/app/actions/contact";
import { Skeleton } from "@/components/ui/skeleton";
import { unwrap } from "@/lib/action-result";
import { requirePermission } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";
import { message_filters_schema } from "@/lib/schemas/contact";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/messages">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/dashboard/messages",
    title: dictionary.messages.meta_title,
    is_private: true,
  });
}

export default async function DashboardMessagesPage({ params, searchParams }: PageProps<"/[lang]/dashboard/messages">) {
  const { lang } = await params;
  await requirePermission(lang, "messages.view");
  const filters = message_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
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
          common={dictionary.common}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
