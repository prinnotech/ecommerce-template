"use client";

import { ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { cn } from "@repo/ui/lib/utils";
import type { AdminDictionary } from "@repo/core/lib/i18n";

export type ManagedImage = {
  id: string;
  url: string;
  alt: string;
  // Option value the image belongs to ("" = every color), see `color_options`.
  color?: string;
};

type ImageManagerProps = {
  images: ManagedImage[];
  can_edit: boolean;
  // Uploading or saving: the controls are disabled and a spinner shows in the add tile.
  is_busy?: boolean;
  max_images?: number;
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  // When given, each image gets a "Shown for" picker (audit P5).
  color_options?: { value: string; label: string }[];
  onColorChange?: (id: string, color: string) => void;
  dictionary: AdminDictionary["admin_ui"]["images"];
};

// Shopify's media card: the first image is the main one (large), then a grid; files can be
// picked or dropped. Uploads, deletes and reordering are the caller's (it owns the mutations).
export function ImageManager({
  images,
  can_edit,
  is_busy,
  max_images,
  onUpload,
  onRemove,
  onMove,
  color_options,
  onColorChange,
  dictionary,
}: ImageManagerProps) {
  const file_input = useRef<HTMLInputElement>(null);
  const select_id = useId();
  const [is_dragging, setDragging] = useState(false);
  const can_add = can_edit && (max_images === undefined || images.length < max_images);

  function pickFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) onUpload(max_images === undefined ? files : files.slice(0, max_images - images.length));
  }

  return (
    <div
      className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", is_dragging && "ring-ring/60 rounded-lg ring-2")}
      onDragOver={(event) => {
        if (!can_add) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (!can_add) return;
        event.preventDefault();
        setDragging(false);
        pickFiles(event.dataTransfer.files);
      }}
    >
      {images.map((image, index) => (
        <figure
          key={image.id}
          className={cn(
            "group bg-muted relative flex flex-col overflow-hidden rounded-lg border",
            index === 0 && "col-span-2 row-span-2",
          )}
        >
          <div className="relative aspect-square">
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes={index === 0 ? "320px" : "160px"}
              className="bg-background object-contain"
            />
            {index === 0 && (
              <span className="bg-background/90 absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium">
                {dictionary.main}
              </span>
            )}
            {can_edit && (
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <span className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    disabled={is_busy || index === 0}
                    onClick={() => onMove(image.id, -1)}
                    aria-label={dictionary.move_earlier}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    disabled={is_busy || index === images.length - 1}
                    onClick={() => onMove(image.id, 1)}
                    aria-label={dictionary.move_later}
                  >
                    <ChevronRightIcon />
                  </Button>
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  disabled={is_busy}
                  onClick={() => onRemove(image.id)}
                  aria-label={dictionary.remove}
                >
                  <Trash2Icon />
                </Button>
              </div>
            )}
          </div>
          {color_options && onColorChange && (
            <figcaption className="bg-background border-t p-1.5">
              <label htmlFor={`${select_id}-${image.id}`} className="sr-only">
                {dictionary.color}
              </label>
              <NativeSelect
                id={`${select_id}-${image.id}`}
                value={image.color ?? ""}
                disabled={!can_edit || is_busy}
                onChange={(event) => onColorChange(image.id, event.target.value)}
                className="h-7 w-full text-xs"
              >
                <NativeSelectOption value="">{dictionary.all_colors}</NativeSelectOption>
                {color_options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </figcaption>
          )}
        </figure>
      ))}

      {can_add && (
        <button
          type="button"
          onClick={() => file_input.current?.click()}
          disabled={is_busy}
          className={cn(
            "text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring/50 flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-2 text-center text-xs outline-none focus-visible:ring-3 disabled:opacity-60",
            images.length === 0 && "col-span-3 aspect-auto py-10 sm:col-span-4",
          )}
        >
          {is_busy ? <Spinner aria-hidden /> : <ImagePlusIcon className="size-5" aria-hidden />}
          <span className="text-foreground font-medium">{is_busy ? dictionary.uploading : dictionary.add}</span>
          <span className="hidden sm:inline">{dictionary.drop_hint}</span>
        </button>
      )}
      {!can_edit && images.length === 0 && (
        <p className="text-muted-foreground col-span-3 py-6 text-center text-sm sm:col-span-4">{dictionary.empty}</p>
      )}

      <input
        ref={file_input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          pickFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
