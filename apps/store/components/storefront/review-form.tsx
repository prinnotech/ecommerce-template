"use client";

import { StarIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField, TextField } from "@repo/core/components/form-field";
import { Button } from "@repo/ui/components/ui/button";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMyReviewState, useSubmitReview } from "@repo/core/hooks/use-reviews";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { review_input_schema } from "@repo/core/lib/schemas/reviews";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";
import { formatPlural } from "@repo/core/lib/utils/format";
import { cn } from "@repo/ui/lib/utils";

type ReviewFormProps = {
  product_id: string;
  lang: string;
  dictionary: Dictionary["store"]["reviews"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

const STARS = [1, 2, 3, 4, 5];

// A sign-in link, the "only buyers" note, the status of the customer's own review, or the form.
export function ReviewForm({ product_id, lang, dictionary, common, errors, validation }: ReviewFormProps) {
  const pathname = usePathname();
  const state = useMyReviewState(product_id);
  const submit = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);

  if (state.isPending) return <Skeleton className="h-10 w-48" />;
  if (state.isError) return null;

  const data = state.data;
  if (data.kind === "signed_out") {
    return (
      <Button variant="outline" className="self-start" asChild>
        <Link href={`/${lang}/auth/login?next=${encodeURIComponent(pathname)}`}>{dictionary.sign_in}</Link>
      </Button>
    );
  }
  if (data.kind === "not_bought") return <p className="text-muted-foreground text-sm">{dictionary.not_bought}</p>;
  if (data.kind === "reviewed") {
    return (
      <p className="text-muted-foreground text-sm">
        {data.review.status === "pending" ? dictionary.pending : dictionary.reviewed}
      </p>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = review_input_schema.safeParse({
      product_id,
      rating,
      title: String(form_data.get("title") ?? ""),
      body: String(form_data.get("body") ?? ""),
      author_name: String(form_data.get("author_name") ?? ""),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    submit.mutate(
      { ...parsed.data, locale: lang },
      {
        onSuccess: () => toast.success(dictionary.submitted),
        onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 border-t pt-4">
      <h3 className="text-sm font-medium">{dictionary.write_title}</h3>
      <FieldGroup>
        <FormField id="review-rating" label={dictionary.rating} error={error("rating")}>
          {(control) => (
            <div
              role="radiogroup"
              id={control.id}
              aria-invalid={control["aria-invalid"]}
              aria-describedby={control["aria-describedby"]}
              className="flex gap-1"
            >
              {STARS.map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={formatPlural(star, dictionary.star, lang)}
                  onClick={() => setRating(star)}
                  className="focus-visible:ring-ring rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <StarIcon
                    className={cn(
                      "size-6",
                      star <= rating ? "fill-foreground text-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          )}
        </FormField>
        <TextField
          name="title"
          label={dictionary.review_title}
          optional_label={common.optional}
          maxLength={120}
          error={error("title")}
        />
        <FormField id="review-body" label={dictionary.body} error={error("body")}>
          {(control) => <Textarea name="body" rows={5} maxLength={4000} {...control} />}
        </FormField>
        <TextField
          name="author_name"
          label={dictionary.author_name}
          defaultValue={data.author_name}
          autoComplete="given-name"
          maxLength={80}
          error={error("author_name")}
        />
      </FieldGroup>
      <Button type="submit" className="self-start" disabled={submit.isPending}>
        {submit.isPending && <Spinner aria-label={common.loading} />}
        {dictionary.submit}
      </Button>
    </form>
  );
}
