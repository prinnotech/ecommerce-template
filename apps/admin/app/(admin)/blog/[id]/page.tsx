import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostEditor } from "../components/post-editor";
import { getBlogPost } from "@repo/core/actions/blog";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.blog.title);
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[id]">) {
  const { id } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("blog.view");
  const post = await getBlogPost(id);
  if (!post.ok) notFound();
  const [dictionary, time_zone] = await Promise.all([getAdminDictionary(lang), getSiteSetting("TIMEZONE")]);
  return (
    <PostEditor
      // A fresh form after each save.
      key={post.data.updated_at}
      lang={lang}
      time_zone={time_zone}
      can_edit={callerShows(caller, "blog.edit")}
      post={post.data}
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
