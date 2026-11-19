import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostList } from "@/components/blog/post-list";
import { getStoreBlogPosts } from "@repo/core/actions/blog";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { store_blog_filters_schema, tag_schema } from "@repo/core/lib/schemas/blog";

function tagOf(raw: string): string | null {
  const parsed = tag_schema.safeParse(decodeURIComponent(raw));
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog/tags/[tag]">): Promise<Metadata> {
  const { lang, tag: raw } = await params;
  const tag = tagOf(raw);
  if (!tag) return { robots: { index: false } };
  const text = (await getDictionary(lang)).store.blog;
  return buildPageMetadata({ lang, path: `/blog/tags/${tag}`, title: text.tagged.replace("{tag}", tag) });
}

// Posts with one tag. Unknown tags show an empty list (tags are free text).
export default async function BlogTagPage({ params, searchParams }: PageProps<"/[lang]/blog/tags/[tag]">) {
  const { lang, tag: raw } = await params;
  const tag = tagOf(raw);
  if (!tag) notFound();
  const { page } = store_blog_filters_schema.parse(await searchParams);
  const [dictionary, posts] = await Promise.all([getDictionary(lang), getStoreBlogPosts({ tag, page })]);
  const text = dictionary.store.blog;
  return (
    <PostList
      title={text.tagged.replace("{tag}", tag)}
      posts={posts.ok ? posts.data : { items: [], page: 1, total_pages: 1, total_items: 0 }}
      lang={lang}
      href={(target) => `/${lang}/blog/tags/${tag}${target > 1 ? `?page=${target}` : ""}`}
      back={{ href: `/${lang}/blog`, label: text.all_posts }}
      empty_text={text.empty_tag}
      text={text}
    />
  );
}
