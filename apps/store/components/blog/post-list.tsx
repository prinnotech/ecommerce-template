import Link from "next/link";

import { PostCard } from "./post-card";
import type { BlogPost } from "@repo/core/actions/blog";
import type { Page } from "@repo/core/backend/types";
import type { Dictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";

type PostListProps = {
  title: string;
  subtitle?: string;
  posts: Page<BlogPost>;
  lang: string;
  // Link for a page number (the list keeps its tag).
  href: (page: number) => string;
  // Shown on a tag page: back to every post.
  back?: { href: string; label: string };
  empty_text: string;
  text: Dictionary["store"]["blog"];
};

// /blog and /blog/tags/<tag>: a grid of posts with previous/next pages.
export function PostList({ title, subtitle, posts, lang, href, back, empty_text, text }: PostListProps) {
  const page_label = text.page.replace("{page}", String(posts.page)).replace("{total}", String(posts.total_pages));
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 lg:py-14">
      <header className="flex max-w-2xl flex-col gap-3">
        {back && (
          <Link href={back.href} className="text-muted-foreground hover:text-foreground text-sm">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground leading-relaxed">{subtitle}</p>}
      </header>

      {posts.items.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center">{empty_text}</p>
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.items.map((post, index) => (
            <PostCard key={post.id} post={post} lang={lang} is_priority={index < 3} />
          ))}
        </div>
      )}

      {posts.total_pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label={page_label}>
          {posts.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={href(posts.page - 1)}>{text.previous}</Link>
            </Button>
          ) : null}
          <span className="text-muted-foreground text-sm">{page_label}</span>
          {posts.page < posts.total_pages ? (
            <Button asChild variant="outline">
              <Link href={href(posts.page + 1)}>{text.next}</Link>
            </Button>
          ) : null}
        </nav>
      )}
    </div>
  );
}
