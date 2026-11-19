"use client";

import { CheckIcon, SearchIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { MediaItem } from "@repo/core/actions/media";
import { useMediaPage, useUploadMedia } from "@repo/core/hooks/use-media";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { MAX_MEDIA_BATCH, MEDIA_TYPES } from "@repo/core/lib/schemas/media";
import { formatPlural } from "@repo/core/lib/utils/format";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type MediaPickerProps = {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  // "single": a click picks the image and closes; "multiple": tick several, then confirm.
  mode: "single" | "multiple";
  onPick: (items: MediaItem[]) => void;
  can_upload: boolean;
  lang: string;
  dictionary: AdminDictionary["files"]["picker"];
  errors: AdminDictionary["errors"];
};

// Content → Files as a dialog: search, upload and pick. Used by the theme editor's image fields and
// the product images. Rendered only while open, so each opening starts fresh.
export function MediaPicker(props: MediaPickerProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={props.onOpenChange}>
      {props.is_open && <PickerBody {...props} />}
    </Dialog>
  );
}

function PickerBody({ onOpenChange, mode, onPick, can_upload, lang, dictionary, errors }: MediaPickerProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const media = useMediaPage({ search, page });
  const upload = useUploadMedia();
  const input = useRef<HTMLInputElement>(null);

  function pick(item: MediaItem) {
    if (mode === "single") {
      onPick([item]);
      onOpenChange(false);
      return;
    }
    setSelected((current) =>
      current.some((other) => other.id === item.id)
        ? current.filter((other) => other.id !== item.id)
        : current.length < MAX_MEDIA_BATCH
          ? [...current, item]
          : current,
    );
  }

  // One at a time: mutate's own callbacks only fire for the last call, so each upload is awaited.
  async function onFiles(files: File[]) {
    for (const file of files.slice(0, MAX_MEDIA_BATCH)) {
      try {
        const item = await upload.mutateAsync(file);
        setPage(1);
        // New uploads are ticked (multiple) so they can be added straight away.
        if (mode === "multiple") setSelected((current) => [...current, item].slice(0, MAX_MEDIA_BATCH));
      } catch (error) {
        toast.error(`${file.name}: ${errorText(errors, error)}`);
      }
    }
  }

  const items = media.data?.items ?? [];
  return (
    <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{mode === "single" ? dictionary.title_one : dictionary.title_many}</DialogTitle>
        <DialogDescription>{dictionary.body}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={search}
            placeholder={dictionary.search}
            aria-label={dictionary.search}
            className="pl-8"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {can_upload && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={MEDIA_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                void onFiles([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
              {upload.isPending ? <Spinner /> : <UploadIcon />}
              {upload.isPending ? dictionary.uploading : dictionary.upload}
            </Button>
          </>
        )}
      </div>

      <div className="-mx-1 min-h-48 flex-1 overflow-y-auto px-1">
        {media.isPending ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : media.isError ? (
          <p className="text-destructive text-sm">{errorText(errors, media.error)}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {search ? dictionary.no_results.replace("{query}", search) : dictionary.empty}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {items.map((item) => {
              const is_selected = selected.some((other) => other.id === item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    aria-pressed={mode === "multiple" ? is_selected : undefined}
                    aria-label={dictionary.choose.replace("{name}", item.name)}
                    className={cn(
                      "focus-visible:ring-ring/50 group relative block w-full overflow-hidden rounded-md border text-left outline-none focus-visible:ring-3",
                      is_selected && "border-primary ring-primary ring-2",
                    )}
                  >
                    <span className="bg-muted relative block aspect-square w-full">
                      <Image src={item.url} alt={item.alt} fill unoptimized sizes="10rem" className="object-cover" />
                    </span>
                    {is_selected && (
                      <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full">
                        <CheckIcon className="size-3.5" aria-hidden />
                      </span>
                    )}
                    <span className="text-muted-foreground block truncate px-1.5 py-1 text-xs">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          {media.data && media.data.total_pages > 1 && (
            <>
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {dictionary.previous}
              </Button>
              <span className="text-muted-foreground tabular-nums">
                {dictionary.page.replace("{page}", String(page)).replace("{total}", String(media.data.total_pages))}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= media.data.total_pages}
                onClick={() => setPage(page + 1)}
              >
                {dictionary.next}
              </Button>
            </>
          )}
        </div>
        {mode === "multiple" && (
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              onPick(selected);
              onOpenChange(false);
            }}
          >
            {formatPlural(Math.max(selected.length, 1), dictionary.add_selected, lang)}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
