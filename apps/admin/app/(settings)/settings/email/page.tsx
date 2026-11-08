import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { EmailSendingScreen } from "./components/email-sending-screen";
import { getEmailSending } from "@repo/core/actions/emails";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.email_sending.title);
}

export default async function EmailSendingPage() {
  const lang = await getAdminLocale();
  const caller = await requirePermission("settings.view");
  const [dictionary, sending] = await Promise.all([getAdminDictionary(lang), getEmailSending()]);
  const query_client = new QueryClient();
  if (sending.ok) query_client.setQueryData(["email_sending"], sending.data);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <EmailSendingScreen
        can_edit={callerShows(caller, "settings.edit") && !caller.is_read_only}
        staff_email={caller.email}
        dictionary={dictionary.email_sending}
        errors={dictionary.errors}
      />
    </HydrationBoundary>
  );
}
