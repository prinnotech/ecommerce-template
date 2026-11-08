import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionEditor } from "../components/collection-editor";
import { getCollection } from "@repo/core/actions/collections";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.collections.title);
}

export default async function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("collections.view");
  const view = await getCollection(id);
  if (!view.ok) notFound();
  const [dictionary, currency] = await Promise.all([getAdminDictionary(lang), getSiteSetting("CURRENCY")]);
  return (
    <CollectionEditor
      // A fresh form after each save.
      key={view.data.collection.updated_at}
      can_edit={callerShows(caller, "collections.edit")}
      view={view.data}
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
