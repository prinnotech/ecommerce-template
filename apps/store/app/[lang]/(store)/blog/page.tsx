import type { Metadata } from "next";

import { PostList } from "@/components/blog/post-list";
import { getStoreBlogPosts } from "@repo/core/actions/blog";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { store_blog_filters_schema } from "@repo/core/lib/schemas/blog";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/blog">): Promise<Metadata> {
  const { lang } = await params;
  const { page } = store_blog_filters_schema.parse(await searchParams);
  const text = (await getDictionary(lang)).store.blog;
  const metadata = await buildPageMetadata({ lang, path: "/blog", title: text.title, description: text.subtitle });
  // Later pages point search engines at the first one.
  return page > 1 ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function BlogPage({ params, searchParams }: PageProps<"/[lang]/blog">) {
  const { lang } = await params;
  const { page } = store_blog_filters_schema.parse(await searchParams);
  const [dictionary, posts] = await Promise.all([getDictionary(lang), getStoreBlogPosts({ page })]);
  const text = dictionary.store.blog;
  return (
    <PostList
      title={text.title}
      subtitle={text.subtitle}
      posts={posts.ok ? posts.data : { items: [], page: 1, total_pages: 1, total_items: 0 }}
      lang={lang}
      href={(target) => `/${lang}/blog${target > 1 ? `?page=${target}` : ""}`}
      empty_text={text.empty}
      text={text}
    />
  );
}
