"use client";

import Image from "next/image";
import { useState, type UIEvent } from "react";

import { cn } from "@repo/ui/lib/utils";

type ProductGalleryProps = {
  images: string[];
  title: string;
  labels: { gallery: string; image_alt: string };
};

// Mobile: swipeable carousel with a counter. Desktop: all images in an editorial grid,
// so shoppers see every photo while the purchase panel stays in view.
export function ProductGallery({ images, title, labels }: ProductGalleryProps) {
  const [current, setCurrent] = useState(0);
  const alt = (index: number) => labels.image_alt.replace("{title}", title).replace("{number}", String(index + 1));

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    setCurrent(Math.round(element.scrollLeft / Math.max(element.clientWidth, 1)));
  }

  if (images.length === 0) {
    return (
      <div className="from-muted to-secondary flex aspect-[4/5] items-center justify-center rounded-lg bg-gradient-to-br p-8">
        <span className="font-display text-muted-foreground text-center text-3xl">{title}</span>
      </div>
    );
  }

  return (
    <section aria-label={labels.gallery}>
      <div className="relative lg:hidden">
        <div
          onScroll={onScroll}
          className="-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <div key={image} className="relative aspect-[4/5] w-full shrink-0 snap-center">
              <Image
                src={image}
                alt={alt(index)}
                fill
                priority={index === 0}
                sizes="100vw"
                className="bg-muted object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
            {images.map((image, index) => (
              <span
                key={image}
                className={cn(
                  "bg-background/60 h-1.5 rounded-full transition-all",
                  index === current ? "bg-background w-5" : "w-1.5",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden grid-cols-2 gap-3 lg:grid">
        {images.map((image, index) => (
          <div
            key={image}
            className={cn("bg-muted relative aspect-[4/5] overflow-hidden rounded-lg", index === 0 && "col-span-2")}
          >
            <Image
              src={image}
              alt={alt(index)}
              fill
              priority={index === 0}
              sizes={index === 0 ? "(min-width: 1280px) 760px, 60vw" : "(min-width: 1280px) 380px, 30vw"}
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
