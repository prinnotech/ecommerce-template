"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import type { ProductReviews as ProductReviewsData } from "@repo/core/actions/reviews";
import { useProductReviews } from "@repo/core/hooks/use-reviews";
import type { Dictionary } from "@repo/core/lib/i18n";
import { formatDate, formatNumber, formatPlural } from "@repo/core/lib/utils/format";
import { ReviewForm } from "@/components/storefront/review-form";
import { StarRating } from "@/components/storefront/star-rating";

type ProductReviewsProps = {
  product_id: string;
  lang: string;
  first_page: ProductReviewsData;
  dictionary: Dictionary["store"]["reviews"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

// The reviews block under the product: rating summary, approved reviews and the review form.
export function ProductReviews({
  product_id,
  lang,
  first_page,
  dictionary,
  common,
  errors,
  validation,
}: ProductReviewsProps) {
  const query = useProductReviews(product_id, first_page);
  const summary = first_page.summary;
  const reviews = query.data.pages.flatMap((page) => page.reviews.items);
  const average = formatNumber(summary.average, lang, { maximumFractionDigits: 1 });

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-title"
      className="mx-auto w-full max-w-7xl scroll-mt-24 border-t px-4 py-10"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
        <div className="flex flex-col gap-4">
          <h2 id="reviews-title" className="font-display text-2xl font-medium tracking-tight">
            {dictionary.title}
          </h2>
          {summary.count > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-semibold tabular-nums">{average}</span>
                <StarRating
                  rating={summary.average}
                  label={dictionary.average.replace("{average}", average)}
                  className="text-lg"
                />
              </div>
              <p className="text-muted-foreground text-sm">{formatPlural(summary.count, dictionary.count, lang)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{dictionary.no_reviews}</p>
          )}
          <ReviewForm
            product_id={product_id}
            lang={lang}
            dictionary={dictionary}
            common={common}
            errors={errors}
            validation={validation}
          />
        </div>

        {reviews.length > 0 && (
          <div className="flex flex-col gap-6">
            <ul className="divide-y border-y">
              {reviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-2 py-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StarRating
                      rating={review.rating}
                      label={dictionary.rated.replace("{rating}", String(review.rating))}
                      className="text-sm"
                    />
                    {review.title && <h3 className="text-sm font-medium">{review.title}</h3>}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{review.body}</p>
                  <p className="text-muted-foreground text-xs">
                    {review.author_name} · {dictionary.verified} · {formatDate(review.created_at, lang)}
                  </p>
                  {review.reply && (
                    <div className="bg-muted/50 mt-2 rounded-md p-3 text-sm">
                      <p className="mb-1 text-xs font-medium">{dictionary.reply}</p>
                      <p className="text-muted-foreground whitespace-pre-line">{review.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {query.hasNextPage && (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage && <Spinner aria-label={common.loading} />}
                {dictionary.show_more}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
