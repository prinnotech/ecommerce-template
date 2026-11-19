import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { FilesScreen } from "./components/files-screen";
import { getMediaPage } from "@repo/core/actions/media";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { media_filters_schema } from "@repo/core/lib/schemas/media";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.files.title);
}

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const lang = await getAdminLocale();
  const caller = await requirePermission("files.view");
  const filters = media_filters_schema.parse(await searchParams);
  const query_client = new QueryClient();
  const [dictionary, media] = await Promise.all([getAdminDictionary(lang), getMediaPage(filters)]);
  if (media.ok) query_client.setQueryData(query_keys.media(filters), media.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <FilesScreen
          lang={lang}
          can_edit={callerShows(caller, "files.edit")}
          dictionary={dictionary.files}
          confirm={dictionary.admin_ui.confirm}
          common={dictionary.common}
          errors={dictionary.errors}
        />
      </Suspense>
    </HydrationBoundary>
  );
}
