"use client";

import { StarIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { AdminReview } from "@repo/core/backend/types";
import { useDeleteReview, useReplyToReview, useReviews, useSetReviewStatus } from "@repo/core/hooks/use-reviews";
import { errorText } from "@repo/core/lib/action-result";
import type { Locale } from "@repo/core/i18nConfig";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { review_filters_schema, type ReviewFilters, type ReviewStatus } from "@repo/core/lib/schemas/reviews";
import { formatDate, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";

const STATUS_TONE: Record<ReviewStatus, StatusTone> = { pending: "attention", approved: "success", hidden: "neutral" };
const VIEWS = ["pending", "approved", "hidden", "all"] as const;

type ReviewsScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["reviews"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          aria-hidden
          className={star <= rating ? "fill-foreground text-foreground size-3.5" : "text-muted-foreground/40 size-3.5"}
        />
      ))}
    </span>
  );
}

export function ReviewsScreen({ lang, can_edit, dictionary, index_table, common, errors }: ReviewsScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = review_filters_schema.parse(Object.fromEntries(search_params));
  const reviews = useReviews(filters);
  const [open_review, setOpenReview] = useState<AdminReview | null>(null);
  const rated = (rating: number) => dictionary.rated.replace("{rating}", String(rating));

  function setFilters(patch: Partial<ReviewFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    // "pending" is the default view, so it stays out of the URL.
    if (next.status !== "pending") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = VIEWS.map((key) => ({ key, label: dictionary.views[key] }));
  const columns: IndexColumn<AdminReview>[] = [
    {
      key: "review",
      header: dictionary.columns.review,
      is_primary: true,
      cell: (review) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{review.title || review.body.slice(0, 80)}</span>
          <span className="text-muted-foreground truncate text-xs">
            {localized(review.product_title, lang as Locale)}
          </span>
        </span>
      ),
    },
    {
      key: "rating",
      header: dictionary.columns.rating,
      min_width: "sm",
      cell: (review) => <Stars rating={review.rating} label={rated(review.rating)} />,
    },
    {
      key: "status",
      header: dictionary.columns.status,
      cell: (review) => <StatusBadge tone={STATUS_TONE[review.status]}>{dictionary.status[review.status]}</StatusBadge>,
    },
    {
      key: "customer",
      header: dictionary.columns.customer,
      min_width: "md",
      cell: (review) => (
        <span className="flex flex-col">
          <span>{review.author_name}</span>
          <span className="text-muted-foreground text-xs">{review.email}</span>
        </span>
      ),
    },
    {
      key: "date",
      header: dictionary.columns.date,
      min_width: "lg",
      align: "end",
      cell: (review) => formatDate(review.created_at, lang),
    },
  ];

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full">
      <IndexTable
        lang={lang}
        rows={reviews.data?.items ?? []}
        getRowId={(review) => review.id}
        onRowClick={setOpenReview}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.status}
        onViewChange={(key) => {
          const status = VIEWS.find((item) => item === key);
          if (status) setFilters({ status });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        page={reviews.data?.page ?? filters.page}
        total_pages={reviews.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={reviews.data ? formatPlural(reviews.data.total_items, dictionary.results, lang) : undefined}
        is_loading={reviews.isFetching}
        empty_state={
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="font-medium">{dictionary.empty_title}</p>
            <p className="text-muted-foreground max-w-md text-sm">{dictionary.empty_body}</p>
          </div>
        }
        dictionary={index_table}
      />
      {reviews.isError && <p className="text-destructive text-sm">{errorText(errors, reviews.error)}</p>}

      {open_review && (
        <ReviewDialog
          // A new key per review resets the reply field.
          key={open_review.id}
          review={open_review}
          onClose={() => setOpenReview(null)}
          lang={lang}
          can_edit={can_edit}
          rated={rated}
          dictionary={dictionary}
          common={common}
          errors={errors}
        />
      )}
    </Page>
  );
}

function ReviewDialog({
  review,
  onClose,
  lang,
  can_edit,
  rated,
  dictionary,
  common,
  errors,
}: {
  review: AdminReview;
  onClose: () => void;
  lang: string;
  can_edit: boolean;
  rated: (rating: number) => string;
  dictionary: AdminDictionary["reviews"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
}) {
  const set_status = useSetReviewStatus();
  const reply = useReplyToReview();
  const remove = useDeleteReview();
  const [status, setStatus] = useState(review.status);
  const [reply_text, setReplyText] = useState(review.reply);
  const [saved_reply, setSavedReply] = useState(review.reply);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const onError = (error: unknown) => toast.error(errorText(errors, error));

  function changeStatus(next: ReviewStatus) {
    set_status.mutate(
      { id: review.id, status: next },
      {
        onSuccess: () => {
          setStatus(next);
          toast.success(dictionary.status_saved);
        },
        onError,
      },
    );
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{review.title || dictionary.untitled}</DialogTitle>
            <DialogDescription>
              {localized(review.product_title, lang as Locale)} · {formatDateTime(review.created_at, lang)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <Stars rating={review.rating} label={rated(review.rating)} />
              <StatusBadge tone={STATUS_TONE[status]}>{dictionary.status[status]}</StatusBadge>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line">{review.body}</p>
            <p className="text-muted-foreground text-xs">
              {review.author_name} · {review.email}
            </p>
            {can_edit ? (
              <Field>
                <FieldLabel htmlFor="review-reply">{dictionary.reply}</FieldLabel>
                <Textarea
                  id="review-reply"
                  rows={3}
                  maxLength={2000}
                  value={reply_text}
                  onChange={(event) => setReplyText(event.target.value)}
                />
                <FieldDescription>{dictionary.reply_hint}</FieldDescription>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={reply.isPending || reply_text.trim() === saved_reply}
                  onClick={() =>
                    reply.mutate(
                      { id: review.id, reply: reply_text },
                      {
                        onSuccess: () => {
                          setSavedReply(reply_text.trim());
                          toast.success(dictionary.reply_saved);
                        },
                        onError,
                      },
                    )
                  }
                >
                  {reply.isPending && <Spinner />}
                  {dictionary.save_reply}
                </Button>
              </Field>
            ) : (
              review.reply && (
                <div className="bg-muted/50 rounded-md p-3 text-sm">
                  <p className="mb-1 text-xs font-medium">{dictionary.reply}</p>
                  <p className="whitespace-pre-line">{review.reply}</p>
                </div>
              )
            )}
          </div>
          {can_edit && (
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => setIsDeleteOpen(true)}>
                {dictionary.delete}
              </Button>
              <div className="flex gap-2">
                {status !== "hidden" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={set_status.isPending}
                    onClick={() => changeStatus("hidden")}
                  >
                    {dictionary.hide}
                  </Button>
                )}
                {status !== "approved" && (
                  <Button type="button" disabled={set_status.isPending} onClick={() => changeStatus("approved")}>
                    {set_status.isPending && <Spinner />}
                    {dictionary.approve}
                  </Button>
                )}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        is_open={is_delete_open}
        onOpenChange={setIsDeleteOpen}
        title={dictionary.delete_title}
        body={dictionary.delete_body}
        confirm_label={dictionary.delete}
        cancel_label={common.cancel}
        is_destructive
        is_pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(review.id, {
            onSuccess: () => {
              toast.success(dictionary.deleted);
              setIsDeleteOpen(false);
              onClose();
            },
            onError,
          })
        }
      />
    </>
  );
}
