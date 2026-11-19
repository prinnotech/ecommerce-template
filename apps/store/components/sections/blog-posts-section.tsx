import { PostCard } from "@/components/blog/post-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { BlogPost } from "@repo/core/actions/blog";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";

type BlogPostsSectionProps = {
  section: SectionOf<"blog_posts">;
  posts: BlogPost[];
  lang: string;
  text: Dictionary["store"]["blog"];
};

// "Latest posts": the newest blog posts as cards. Nothing is shown until there is a post.
export function BlogPostsSection({ section, posts, lang, text }: BlogPostsSectionProps) {
  if (posts.length === 0) return null;
  const { heading, tag, show_view_all } = section.settings;
  const title = localized(heading, lang as Locale) || text.title;
  const view_all = tag ? `/${lang}/blog/tags/${encodeURIComponent(tag)}` : `/${lang}/blog`;
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 lg:py-16">
      <SectionHeading title={title} link={show_view_all ? { href: view_all, label: text.view_all } : undefined} />
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} lang={lang} />
        ))}
      </div>
    </section>
  );
}
