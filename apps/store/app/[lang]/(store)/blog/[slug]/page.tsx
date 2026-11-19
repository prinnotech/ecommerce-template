import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostBody } from "@/components/blog/post-body";
import { getStoreBlogPost } from "@repo/core/actions/blog";
import type { Locale } from "@repo/core/i18nConfig";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { SITE_URL } from "@repo/core/lib/site-config";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { formatDate } from "@repo/core/lib/utils/format";

// Rendered on the first visit, then cached; saving a post in the admin refreshes the store.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const post = await getStoreBlogPost(slug);
  if (!post.ok) return { robots: { index: false } };
  const locale = lang as Locale;
  const metadata = await buildPageMetadata({
    lang,
    path: `/blog/${slug}`,
    title: localized(post.data.seo.title, locale) || localized(post.data.title, locale),
    description: localized(post.data.seo.description, locale) || localized(post.data.excerpt, locale).slice(0, 160),
  });
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: post.data.published_at,
      ...(post.data.cover_url ? { images: [{ url: new URL(post.data.cover_url, SITE_URL).toString() }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/[lang]/blog/[slug]">) {
  const { lang, slug } = await params;
  const [result, dictionary, site_name] = await Promise.all([
    getStoreBlogPost(slug),
    getDictionary(lang),
    getSiteSetting("SITE_NAME"),
  ]);
  if (!result.ok) notFound();
  const post = result.data;
  const locale = lang as Locale;
  const text = dictionary.store.blog;
  const title = localized(post.title, locale) || post.slug;
  const excerpt = localized(post.excerpt, locale);
  const json_ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: excerpt || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    image: post.cover_url ? new URL(post.cover_url, SITE_URL).toString() : undefined,
    author: post.author ? { "@type": "Person", name: post.author } : { "@type": "Organization", name: site_name },
    publisher: { "@type": "Organization", name: site_name },
    mainEntityOfPage: `${SITE_URL}/${lang}/blog/${post.slug}`,
    keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
  };

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 lg:py-14">
      <script
        type="application/ld+json"
        // JSON from our own data; "<" is escaped so it can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(json_ld).replace(/</g, "\\u003c") }}
      />
      <header className="flex flex-col gap-4">
        <Link href={`/${lang}/blog`} className="text-muted-foreground hover:text-foreground text-sm">
          ← {text.back}
        </Link>
        <h1 className="font-display text-3xl font-medium tracking-tight text-balance md:text-5xl">{title}</h1>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
          {post.published_at && <time dateTime={post.published_at}>{formatDate(post.published_at, lang)}</time>}
          {post.author && (
            <>
              <span aria-hidden>·</span>
              <span>{text.by.replace("{author}", post.author)}</span>
            </>
          )}
        </p>
        {excerpt && <p className="text-muted-foreground text-lg leading-relaxed">{excerpt}</p>}
      </header>

      {post.cover_url && (
        <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden rounded-lg">
          <Image
            src={post.cover_url}
            alt={localized(post.cover_alt, locale)}
            fill
            unoptimized
            priority
            sizes="(min-width: 768px) 48rem, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <PostBody blocks={post.body} lang={lang} />

      {post.tags.length > 0 && (
        <footer className="flex flex-wrap items-center gap-2 border-t pt-6">
          <span className="text-muted-foreground text-sm">{text.tags}</span>
          <ul className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/${lang}/blog/tags/${encodeURIComponent(tag)}`}
                  className="bg-muted hover:bg-muted/70 rounded-full px-3 py-1 text-sm"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
