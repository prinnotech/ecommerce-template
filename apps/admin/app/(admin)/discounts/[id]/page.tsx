import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DiscountEditor } from "../components/discount-editor";
import { getDiscount } from "@repo/core/actions/discounts";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.discounts.title);
}

export default async function DiscountPage({ params }: PageProps<"/discounts/[id]">) {
  const { id } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("discounts.view");
  const view = await getDiscount(id);
  if (!view.ok) notFound();
  const [dictionary, settings] = await Promise.all([getAdminDictionary(lang), getSiteSettings()]);

  return (
    <DiscountEditor
      // A fresh form after each save (the page re-renders with the stored values).
      key={view.data.discount.updated_at}
      lang={lang}
      currency={settings.CURRENCY}
      time_zone={settings.TIMEZONE}
      can_edit={callerShows(caller, "discounts.edit")}
      view={view.data}
      dictionary={dictionary.discounts}
      confirm={dictionary.admin_ui.confirm}
      save_bar={dictionary.admin_ui.save_bar}
      errors={dictionary.errors}
    />
  );
}
