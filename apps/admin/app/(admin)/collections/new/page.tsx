import type { Metadata } from "next";

import { CollectionEditor } from "../components/collection-editor";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.collections.new_title);
}

export default async function NewCollectionPage() {
  const lang = await getAdminLocale();
  await requirePermission("collections.edit");
  const [dictionary, currency] = await Promise.all([getAdminDictionary(lang), getSiteSetting("CURRENCY")]);
  return (
    <CollectionEditor
      can_edit
      view={null}
      lang={lang}
      currency={currency}
      seo={dictionary.admin_ui.seo}
      dictionary={dictionary.collections}
      common={dictionary.common}
      confirm={dictionary.admin_ui.confirm}
      save_bar={dictionary.admin_ui.save_bar}
      errors={dictionary.errors}
    />
  );
}
