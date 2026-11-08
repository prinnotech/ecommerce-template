import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { StoreCategory } from "@repo/core/actions/storefront";
import { SectionHeading } from "@/components/storefront/section-heading";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import { cn } from "@repo/ui/lib/utils";

type CategoryTilesSectionProps = {
  section: SectionOf<"category_tiles">;
  categories: StoreCategory[];
  lang: string;
};

// The chosen categories, in the chosen order; none chosen = the first top-level ones.
export function pickCategories(section: SectionOf<"category_tiles">, categories: StoreCategory[]): StoreCategory[] {
  const { category_ids, limit } = section.settings;
  if (category_ids.length === 0) return categories.filter((category) => !category.parent).slice(0, limit);
  return category_ids
    .map((id) => categories.find((category) => category.id === id))
    .filter((category) => category !== undefined)
    .slice(0, limit);
}

export function CategoryTilesSection({ section, categories, lang }: CategoryTilesSectionProps) {
  const locale = lang as Locale;
  const tiles = pickCategories(section, categories);
  if (tiles.length === 0) return null;
  const heading = localized(section.settings.heading, locale);

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:py-14">
      {heading && <SectionHeading title={heading} />}
      <ul className={cn("grid grid-cols-2 gap-4", tiles.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        {tiles.map((category) => (
          <li key={category.id}>
            <Link
              href={`/${lang}/shop?category=${category.slug}`}
              className="group bg-muted relative flex aspect-[4/5] items-end overflow-hidden rounded-lg"
            >
              {category.image_url ? (
                <>
                  <Image
                    src={category.image_url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="from-primary/60 absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent" />
                </>
              ) : (
                // No photo: a clean tile with dark text instead of a dark overlay on grey.
                <div className="from-secondary to-muted group-hover:from-muted absolute inset-0 bg-gradient-to-br transition-colors" />
              )}
              <span
                className={cn(
                  "font-display relative flex w-full items-center justify-between p-5 text-xl font-medium sm:text-2xl",
                  category.image_url ? "text-primary-foreground" : "text-foreground",
                )}
              >
                {localized(category.name, locale)}
                <ArrowRightIcon
                  className="size-5 transition-transform group-hover:translate-x-1"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
