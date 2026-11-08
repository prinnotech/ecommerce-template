import { StarIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

type StarRatingProps = {
  rating: number;
  // Read by screen readers instead of the stars ("Rated 4.5 out of 5").
  label: string;
  className?: string;
};

const STARS = [1, 2, 3, 4, 5];

// Five stars, filled up to the rating (partial stars by clipping the filled row).
export function StarRating({ rating, label, className }: StarRatingProps) {
  const percent = `${Math.max(0, Math.min(5, rating)) * 20}%`;
  return (
    <span role="img" aria-label={label} className={cn("relative inline-flex shrink-0", className)}>
      <span className="text-muted-foreground/40 flex" aria-hidden>
        {STARS.map((star) => (
          <StarIcon key={star} className="size-[1em] fill-current" />
        ))}
      </span>
      <span
        className="text-foreground absolute inset-y-0 left-0 flex overflow-hidden"
        style={{ width: percent }}
        aria-hidden
      >
        {STARS.map((star) => (
          <StarIcon key={star} className="size-[1em] shrink-0 fill-current" />
        ))}
      </span>
    </span>
  );
}
