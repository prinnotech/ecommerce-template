import type { Metadata } from "next";

import { DiscountEditor } from "../components/discount-editor";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.discounts.new_title);
}

export default async function NewDiscountPage() {
  const lang = await getAdminLocale();
  await requirePermission("discounts.edit");
  const [dictionary, settings] = await Promise.all([getAdminDictionary(lang), getSiteSettings()]);

  return (
    <DiscountEditor
      lang={lang}
      currency={settings.CURRENCY}
      time_zone={settings.TIMEZONE}
      can_edit
      view={null}
      dictionary={dictionary.discounts}
      confirm={dictionary.admin_ui.confirm}
      save_bar={dictionary.admin_ui.save_bar}
      errors={dictionary.errors}
    />
  );
}
