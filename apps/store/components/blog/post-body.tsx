import Image from "next/image";

import { RichText } from "@/components/storefront/rich-text";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import type { BlogBlock } from "@repo/core/lib/schemas/blog";

// A post's blocks in the store's language (English, then any language with text, when missing).
// Text is rendered as text, never as HTML.
export function PostBody({ blocks, lang }: { blocks: BlogBlock[]; lang: string }) {
  const locale = lang as Locale;
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading": {
            const text = localized(block.text, locale);
            return text ? (
              <h2 key={block.id} className="font-display mt-4 text-2xl font-medium tracking-tight">
                {text}
              </h2>
            ) : null;
          }
          case "paragraph": {
            const text = localized(block.text, locale);
            return text ? <RichText key={block.id} text={text} className="text-foreground/90 text-lg" /> : null;
          }
          case "quote": {
            const text = localized(block.text, locale);
            return text ? (
              <figure key={block.id} className="border-primary flex flex-col gap-2 border-l-2 pl-5">
                <blockquote className="font-display text-xl leading-relaxed italic">{text}</blockquote>
                {block.cite && <figcaption className="text-muted-foreground text-sm">— {block.cite}</figcaption>}
              </figure>
            ) : null;
          }
          case "image": {
            if (!block.url) return null;
            const caption = localized(block.caption, locale);
            return (
              <figure key={block.id} className="flex flex-col gap-2">
                <div className="bg-muted relative aspect-[3/2] w-full overflow-hidden rounded-lg">
                  <Image
                    src={block.url}
                    alt={localized(block.alt, locale)}
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 48rem, 100vw"
                    className="object-cover"
                  />
                </div>
                {caption && <figcaption className="text-muted-foreground text-center text-sm">{caption}</figcaption>}
              </figure>
            );
          }
        }
      })}
    </div>
  );
}
