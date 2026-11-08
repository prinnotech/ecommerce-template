import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@repo/ui/lib/utils";

const SIZES = { sm: "size-10", md: "size-11", lg: "size-16" };
const PIXELS = { sm: 40, md: 44, lg: 64 };

type ThumbnailProps = {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
};

// Product photos are often on white: the border keeps them visible on white cards (audit P4).
export function Thumbnail({ src, alt, size = "md", className }: ThumbnailProps) {
  return (
    <span
      className={cn(
        "bg-muted relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border",
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${PIXELS[size] * 2}px`} className="object-contain" />
      ) : (
        <ImageIcon className="text-muted-foreground size-4" aria-hidden />
      )}
    </span>
  );
}
