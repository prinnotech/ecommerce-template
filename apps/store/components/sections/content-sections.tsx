import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { sectionHref } from "./section-link";
import { ContactDetails } from "@/components/storefront/contact-details";
import { ContactForm } from "@/components/storefront/contact-form";
import { RichText } from "@/components/storefront/rich-text";
import type { Locale } from "@repo/core/i18nConfig";
import type { Dictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { SectionOf } from "@repo/core/lib/schemas/theme";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { cn } from "@repo/ui/lib/utils";

// The simpler content sections: page title, FAQ, gallery, video, spacer, contact form.

const heading_class = "font-display text-3xl font-medium tracking-tight sm:text-4xl";

export function PageHeaderSection({ section, lang }: { section: SectionOf<"page_header">; lang: string }) {
  const locale = lang as Locale;
  const { settings } = section;
  const eyebrow = localized(settings.eyebrow, locale);
  const heading = localized(settings.heading, locale);
  const subtitle = localized(settings.subtitle, locale);
  const is_center = settings.alignment === "center";
  return (
    <header
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-14 pb-6 sm:pt-20",
        is_center && "items-center text-center",
      )}
    >
      {eyebrow && <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{eyebrow}</p>}
      {heading && (
        <h1 className="font-display max-w-3xl text-4xl leading-tight font-medium tracking-tight text-balance sm:text-6xl">
          {heading}
        </h1>
      )}
      {subtitle && <p className="text-muted-foreground max-w-2xl text-lg">{subtitle}</p>}
    </header>
  );
}

export function FaqSection({ section, lang }: { section: SectionOf<"faq">; lang: string }) {
  const locale = lang as Locale;
  const items = section.settings.items
    .map((item) => ({
      id: item.id,
      question: localized(item.question, locale),
      answer: localized(item.answer, locale),
    }))
    .filter((item) => item.question);
  if (items.length === 0) return null;
  const heading = localized(section.settings.heading, locale);
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
      {heading && <h2 className={heading_class}>{heading}</h2>}
      <div className="divide-y border-y">
        {items.map((item) => (
          // Native <details>: accessible and works without JavaScript.
          <details key={item.id} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            {item.answer && <RichText text={item.answer} className="pt-3 text-sm" />}
          </details>
        ))}
      </div>
    </section>
  );
}

const GALLERY_COLUMNS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

export function GallerySection({ section, lang }: { section: SectionOf<"gallery">; lang: string }) {
  const locale = lang as Locale;
  const images = section.settings.images.filter((image) => image.image_url);
  if (images.length === 0) return null;
  const heading = localized(section.settings.heading, locale);
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:py-14">
      {heading && <h2 className={heading_class}>{heading}</h2>}
      <ul className={cn("grid grid-cols-2 gap-4", GALLERY_COLUMNS[section.settings.columns])}>
        {images.map((image) => {
          const caption = localized(image.caption, locale);
          const content = (
            <figure className="flex flex-col gap-2">
              <div className="bg-muted relative aspect-[4/5] overflow-hidden rounded-lg">
                <Image
                  src={image.image_url}
                  alt={caption}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              {caption && <figcaption className="text-muted-foreground text-sm">{caption}</figcaption>}
            </figure>
          );
          return (
            <li key={image.id}>
              {image.href ? (
                <Link href={sectionHref(image.href, lang)} className="group block">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// YouTube / Vimeo links become their privacy-friendly embeds; anything else plays as a file.
function videoEmbed(url: string): { kind: "embed"; src: string } | { kind: "file"; src: string } | null {
  if (!url) return null;
  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (youtube) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${youtube[1]}` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  return { kind: "file", src: url };
}

type VideoSectionProps = { section: SectionOf<"video">; lang: string; fallback_title: string };

export function VideoSection({ section, lang, fallback_title }: VideoSectionProps) {
  const locale = lang as Locale;
  const video = videoEmbed(section.settings.url);
  if (!video) return null;
  const heading = localized(section.settings.heading, locale);
  const caption = localized(section.settings.caption, locale);
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
      {heading && <h2 className={heading_class}>{heading}</h2>}
      <figure className="flex flex-col gap-3">
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
          {video.kind === "embed" ? (
            <iframe
              src={video.src}
              title={heading || caption || fallback_title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              loading="lazy"
              className="absolute inset-0 size-full"
            />
          ) : (
            <video src={video.src} controls playsInline preload="metadata" className="absolute inset-0 size-full" />
          )}
        </div>
        {caption && <figcaption className="text-muted-foreground text-sm">{caption}</figcaption>}
      </figure>
    </section>
  );
}

const SPACER_SIZES = { small: "h-6", medium: "h-12 sm:h-16", large: "h-20 sm:h-28" } as const;

export function SpacerSection({ section }: { section: SectionOf<"spacer"> }) {
  const { size, show_divider } = section.settings;
  return (
    <div aria-hidden className={cn("mx-auto flex w-full max-w-7xl items-center px-4", SPACER_SIZES[size])}>
      {show_divider && <hr className="w-full" />}
    </div>
  );
}

type ContactFormSectionProps = {
  section: SectionOf<"contact_form">;
  lang: string;
  settings: SiteSettings;
  dictionary: Dictionary;
};

export function ContactFormSection({ section, lang, settings, dictionary }: ContactFormSectionProps) {
  const heading = localized(section.settings.heading, lang as Locale);
  const heading_id = `contact-form-${section.id}`;
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-6xl gap-12 px-4 py-10 sm:py-14",
        section.settings.show_details && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16",
      )}
    >
      <section className="flex flex-col gap-6" aria-labelledby={heading ? heading_id : undefined}>
        {heading && (
          <h2 id={heading_id} className="text-xl font-semibold">
            {heading}
          </h2>
        )}
        <ContactForm
          dictionary={dictionary.contact}
          common={dictionary.common}
          errors={dictionary.errors}
          validation={dictionary.validation}
        />
      </section>
      {section.settings.show_details && (
        <aside className="bg-muted/40 flex h-fit flex-col gap-6 rounded-xl border p-6">
          <h2 className="font-medium">{dictionary.contact.details_title}</h2>
          <ContactDetails settings={settings} lang={lang} labels={dictionary.contact} />
        </aside>
      )}
    </div>
  );
}
