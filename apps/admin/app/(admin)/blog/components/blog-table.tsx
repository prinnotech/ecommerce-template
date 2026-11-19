"use client";

import { NewspaperIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@repo/admin-ui/components/empty-state";
import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { BlogPost } from "@repo/core/actions/blog";
import { useBlogPosts } from "@repo/core/hooks/use-blog";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import {
  BLOG_POST_STATUSES,
  blog_list_filters_schema,
  type BlogListFilters,
  type BlogPostStatus,
} from "@repo/core/lib/schemas/blog";
import { formatDate, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";

export const POST_TONE: Record<BlogPostStatus, StatusTone> = {
  published: "success",
  scheduled: "info",
  draft: "neutral",
};

type BlogTableProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["blog"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  errors: AdminDictionary["errors"];
};

export function BlogTable({ lang, can_edit, dictionary, index_table, errors }: BlogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = blog_list_filters_schema.parse(Object.fromEntries(search_params));
  const posts = useBlogPosts(filters);
  const locale = lang as Locale;
  const titleOf = (post: BlogPost) => localized(post.title, locale) || post.slug;

  function setFilters(patch: Partial<BlogListFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = [
    { key: "all", label: dictionary.all },
    ...BLOG_POST_STATUSES.map((status) => ({ key: status, label: dictionary.status[status] })),
  ];

  const columns: IndexColumn<BlogPost>[] = [
    {
      key: "title",
      header: dictionary.columns.title,
      is_primary: true,
      cell: (post) => (
        <span className="flex min-w-0 items-center gap-3">
          <Thumbnail src={post.cover_url} alt="" size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{titleOf(post)}</span>
            {post.tags.length > 0 && (
              <span className="text-muted-foreground truncate text-xs">{post.tags.join(", ")}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (post) => <StatusBadge tone={POST_TONE[post.status]}>{dictionary.status[post.status]}</StatusBadge>,
    },
    {
      key: "date",
      header: dictionary.columns.date,
      min_width: "md",
      cell: (post) => (post.published_at ? formatDate(post.published_at, lang) : "—"),
    },
    {
      key: "author",
      header: dictionary.columns.author,
      min_width: "lg",
      cell: (post) => post.author || "—",
    },
  ];

  const create_action = can_edit ? (
    <Button asChild>
      <Link href="/blog/new">
        <PlusIcon />
        {dictionary.create}
      </Link>
    </Button>
  ) : undefined;

  return (
    <Page title={dictionary.title} width="full" primary_action={create_action}>
      <IndexTable
        lang={lang}
        rows={posts.data?.items ?? []}
        getRowId={(post) => post.id}
        getRowHref={(post) => `/blog/${post.id}`}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.status}
        onViewChange={(key) => {
          const status = key === "all" ? "all" : BLOG_POST_STATUSES.find((item) => item === key);
          if (status) setFilters({ status });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        page={posts.data?.page ?? filters.page}
        total_pages={posts.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={posts.data ? formatPlural(posts.data.total_items, dictionary.results, lang) : undefined}
        is_loading={posts.isFetching}
        empty_state={
          <EmptyState
            icon={NewspaperIcon}
            title={dictionary.empty_title}
            body={dictionary.empty_body}
            action={create_action}
          />
        }
        renderMobileRow={(post) => (
          <div className="flex items-center gap-3">
            <Thumbnail src={post.cover_url} alt="" size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-medium">{titleOf(post)}</span>
              <StatusBadge tone={POST_TONE[post.status]}>{dictionary.status[post.status]}</StatusBadge>
            </div>
          </div>
        )}
        dictionary={index_table}
      />
      {posts.isError && <p className="text-destructive text-sm">{errorText(errors, posts.error)}</p>}
    </Page>
  );
}
