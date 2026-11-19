import type { Metadata } from "next";

import { CampaignEditor } from "../components/campaign-editor";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { requirePermission } from "@repo/core/lib/auth";
import { isSmtpConfigured } from "@repo/core/lib/email/transport";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.campaigns.new_title);
}

export default async function NewCampaignPage() {
  const lang = await getAdminLocale();
  await requirePermission("campaigns.edit");
  const [dictionary, smtp] = await Promise.all([getAdminDictionary(lang), getSiteSetting("SMTP")]);
  return (
    <CampaignEditor
      lang={lang}
      can_edit
      campaign_id={null}
      has_smtp={isSmtpConfigured(smtp)}
      dictionary={dictionary.campaigns}
      common={dictionary.common}
      confirm={dictionary.admin_ui.confirm}
      save_bar={dictionary.admin_ui.save_bar}
      errors={dictionary.errors}
    />
  );
}
