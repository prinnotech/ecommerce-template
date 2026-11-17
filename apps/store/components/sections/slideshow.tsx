"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export type Slide = {
  id: string;
  image_url: string;
  heading: string;
  subtitle: string;
  button: { label: string; href: string } | null;
};

type SlideshowProps = {
  slides: Slide[];
  // Seconds per slide; 0 = only the arrows and dots change it.
  autoplay_seconds: number;
  height: "small" | "medium" | "large";
  alignment: "center" | "left";
  // The first section's first heading is the page's h1.
  is_first: boolean;
  labels: { previous: string; next: string; go_to: string };
};

const HEIGHTS = { small: "min-h-[40svh]", medium: "min-h-[55svh]", large: "min-h-[75svh]" } as const;

// Full-width slides that change on their own (paused on hover, focus, or when the visitor prefers
// reduced motion), with arrows and dots. Slides that aren't showing stay in the DOM but hidden.
export function Slideshow({ slides, autoplay_seconds, height, alignment, is_first, labels }: SlideshowProps) {
  const [index, setIndex] = useState(0);
  const [is_paused, setIsPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || autoplay_seconds === 0 || is_paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), autoplay_seconds * 1000);
    return () => clearInterval(timer);
  }, [count, autoplay_seconds, is_paused]);

  if (count === 0) return null;
  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);
  const is_left = alignment === "left";
  const heading_class =
    "font-display max-w-3xl text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl";

  return (
    <section
      aria-roledescription="carousel"
      className={cn("relative grid overflow-hidden", HEIGHTS[height])}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      {slides.map((slide, slide_index) => {
        const is_current = slide_index === index;
        const has_image = Boolean(slide.image_url);
        // The first section's first heading is the page's h1.
        const is_h1 = is_first && slide_index === 0;
        return (
          <div
            key={slide.id}
            aria-roledescription="slide"
            aria-hidden={!is_current}
            inert={!is_current}
            className={cn(
              "relative col-start-1 row-start-1 flex items-end transition-opacity duration-700",
              is_current ? "opacity-100" : "pointer-events-none opacity-0",
              !has_image && "bg-muted/50",
            )}
          >
            {has_image && (
              <>
                <Image
                  src={slide.image_url}
                  alt=""
                  fill
                  priority={is_first && slide_index === 0}
                  unoptimized
                  sizes="100vw"
                  className="object-cover"
                />
                <div className="from-primary/70 via-primary/20 absolute inset-0 bg-gradient-to-t to-transparent" />
              </>
            )}
            <div
              className={cn(
                "relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-16 sm:py-24",
                is_left ? "items-start text-left" : "items-center text-center",
                has_image && "text-primary-foreground",
              )}
            >
              {slide.heading &&
                (is_h1 ? (
                  <h1 className={heading_class}>{slide.heading}</h1>
                ) : (
                  <h2 className={heading_class}>{slide.heading}</h2>
                ))}
              {slide.subtitle && (
                <p className={cn("max-w-xl text-base text-balance sm:text-lg", !has_image && "text-muted-foreground")}>
                  {slide.subtitle}
                </p>
              )}
              {slide.button && (
                <Button
                  asChild
                  size="lg"
                  data-on-image={has_image || undefined}
                  className={cn(
                    "h-12 px-8 text-base",
                    has_image && "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
                  )}
                >
                  <Link href={slide.button.href}>{slide.button.label}</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={labels.previous}
            className="bg-background/80 text-foreground hover:bg-background rounded-full p-1.5 shadow-sm"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((slide, slide_index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setIndex(slide_index)}
                aria-label={labels.go_to.replace("{number}", String(slide_index + 1))}
                aria-current={slide_index === index}
                className={cn(
                  "bg-background/80 h-2 rounded-full shadow-sm transition-all",
                  slide_index === index ? "w-6" : "w-2 opacity-60",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={labels.next}
            className="bg-background/80 text-foreground hover:bg-background rounded-full p-1.5 shadow-sm"
          >
            <ChevronRightIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
