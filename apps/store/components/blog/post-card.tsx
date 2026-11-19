import Image from "next/image";
import Link from "next/link";

import type { BlogPost } from "@repo/core/actions/blog";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import { formatDate } from "@repo/core/lib/utils/format";

type PostCardProps = {
  post: BlogPost;
  lang: string;
  // The first cards of a page load eagerly (they're above the fold).
  is_priority?: boolean;
};

// A post in a list: cover, date, title and excerpt. The whole card is one link.
export function PostCard({ post, lang, is_priority = false }: PostCardProps) {
  const locale = lang as Locale;
  const title = localized(post.title, locale) || post.slug;
  const excerpt = localized(post.excerpt, locale);
  return (
    <article className="group flex flex-col gap-3">
      <Link href={`/${lang}/blog/${post.slug}`} className="flex flex-col gap-3">
        <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden rounded-lg">
          {post.cover_url && (
            // The owner may link an image from any host, so the optimizer is skipped.
            <Image
              src={post.cover_url}
              alt={localized(post.cover_alt, locale)}
              fill
              unoptimized
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading={is_priority ? "eager" : "lazy"}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {post.published_at && (
            <time dateTime={post.published_at} className="text-muted-foreground text-xs tracking-wide uppercase">
              {formatDate(post.published_at, lang)}
            </time>
          )}
          <h2 className="font-display text-xl font-medium tracking-tight group-hover:underline">{title}</h2>
          {excerpt && <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">{excerpt}</p>}
        </div>
      </Link>
    </article>
  );
}
