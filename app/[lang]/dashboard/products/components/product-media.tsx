"use client";

import { ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { AdminProductImage } from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRemoveProductImage, useReorderProductImages, useUploadProductImage } from "@/hooks/use-catalog";
import type { Locale } from "@/i18nConfig";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { localized, type LocalizedText } from "@/lib/localized";
import { MAX_PRODUCT_IMAGES } from "@/lib/schemas/catalog";

type ProductMediaProps = {
  product_id: string;
  title: LocalizedText;
  images: AdminProductImage[];
  can_edit: boolean;
  lang: string;
  dictionary: Dictionary["catalog"]["editor"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

export function ProductMedia({
  product_id,
  title,
  images,
  can_edit,
  lang,
  dictionary,
  common,
  errors,
}: ProductMediaProps) {
  const upload = useUploadProductImage(product_id);
  const remove = useRemoveProductImage();
  const reorder = useReorderProductImages();
  const file_input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const is_busy = progress !== null || remove.isPending || reorder.isPending;
  const product_title = localized(title, lang as Locale);

  // One file per request keeps each upload under the server action size limit.
  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const queue = [...files].slice(0, Math.max(MAX_PRODUCT_IMAGES - images.length, 0));
    if (queue.length < files.length) toast.error(errors.too_many_images);
    for (const [index, file] of queue.entries()) {
      setProgress({ current: index + 1, total: queue.length });
      const form_data = new FormData();
      form_data.set("product_id", product_id);
      form_data.set("image", file);
      try {
        await upload.mutateAsync(form_data);
      } catch (error) {
        toast.error(`${file.name}: ${errorText(errors, error)}`);
      }
    }
    setProgress(null);
  }

  function move(index: number, offset: -1 | 1) {
    const names = images.map((image) => image.name);
    const [moved] = names.splice(index, 1);
    names.splice(index + offset, 0, moved);
    reorder.mutate({ product_id, images: names }, { onError: (error) => toast.error(errorText(errors, error)) });
  }

  function onRemove(name: string) {
    remove.mutate({ product_id, image: name }, { onError: (error) => toast.error(errorText(errors, error)) });
  }

  return (
    <div className="flex flex-col gap-4">
      {images.length === 0 && !progress && <p className="text-muted-foreground text-sm">{dictionary.no_images}</p>}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.name} className="flex flex-col gap-1.5">
              <div className="bg-muted relative aspect-[4/5] overflow-hidden rounded-lg border">
                <Image
                  src={image.url}
                  alt={dictionary.image_alt.replace("{number}", String(index + 1)).replace("{title}", product_title)}
                  fill
                  sizes="200px"
                  unoptimized
                  className="object-cover"
                />
                {index === 0 && <Badge className="absolute top-2 left-2">{dictionary.main_image}</Badge>}
              </div>
              {can_edit && (
                <div className="flex items-center justify-between">
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={dictionary.move_left}
                      disabled={index === 0 || is_busy}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={dictionary.move_right}
                      disabled={index === images.length - 1 || is_busy}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={dictionary.remove_image}
                    disabled={is_busy}
                    onClick={() => onRemove(image.name)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {can_edit && images.length < MAX_PRODUCT_IMAGES && (
        <div className="flex items-center gap-3">
          <input
            ref={file_input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="outline" disabled={is_busy} onClick={() => file_input.current?.click()}>
            {progress ? <Spinner aria-label={common.loading} /> : <ImagePlusIcon />}
            {dictionary.upload}
          </Button>
          {progress && (
            <span role="status" className="text-muted-foreground text-sm">
              {dictionary.uploading
                .replace("{current}", String(progress.current))
                .replace("{total}", String(progress.total))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
