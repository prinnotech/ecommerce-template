import type { Metadata } from "next";

import { PostEditor } from "../components/post-editor";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.blog.editor.new_title);
}

export default async function NewBlogPostPage() {
  const lang = await getAdminLocale();
  await requirePermission("blog.edit");
  const [dictionary, time_zone] = await Promise.all([getAdminDictionary(lang), getSiteSetting("TIMEZONE")]);
  return (
    <PostEditor
      lang={lang}
      time_zone={time_zone}
      can_edit
      post={null}
      dictionary={dictionary.blog}
      seo={dictionary.admin_ui.seo}
      common={dictionary.common}
      confirm={dictionary.admin_ui.confirm}
      save_bar={dictionary.admin_ui.save_bar}
      files_picker={dictionary.files.picker}
      errors={dictionary.errors}
    />
  );
}
