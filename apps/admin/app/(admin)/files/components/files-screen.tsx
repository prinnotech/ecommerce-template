"use client";

import { ImagesIcon, SearchIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FileDetailsDialog } from "./file-details-dialog";
import { EmptyState } from "@repo/admin-ui/components/empty-state";
import { Page } from "@repo/admin-ui/components/page";
import type { MediaItem } from "@repo/core/actions/media";
import { useMediaPage, useUploadMedia } from "@repo/core/hooks/use-media";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { MAX_MEDIA_BATCH, MEDIA_TYPES, media_filters_schema, type MediaFilters } from "@repo/core/lib/schemas/media";
import { formatFileSize, formatPlural } from "@repo/core/lib/utils/format";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type FilesScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["files"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Content → Files: every image uploaded for themes, pages and products. Drop files anywhere on the
// grid or use Upload; click one to rename it, set its alt text, copy its link or delete it.
export function FilesScreen({ lang, can_edit, dictionary, confirm, common, errors }: FilesScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = media_filters_schema.parse(Object.fromEntries(search_params));
  const media = useMediaPage(filters);
  const upload = useUploadMedia();
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(filters.search);
  const [is_dragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [open_item, setOpenItem] = useState<MediaItem | null>(null);

  function setFilters(patch: Partial<MediaFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // One file at a time (server actions run one after another anyway); mutate's own callbacks
  // only fire for the last call, so each upload is awaited.
  async function onFiles(files: File[]) {
    const accepted = files.filter((file) => (MEDIA_TYPES as readonly string[]).includes(file.type));
    if (accepted.length < files.length) toast.error(errors.invalid_image);
    const batch = accepted.slice(0, MAX_MEDIA_BATCH);
    if (batch.length === 0) return;
    setUploading((count) => count + batch.length);
    let uploaded = 0;
    for (const file of batch) {
      try {
        await upload.mutateAsync(file);
        uploaded += 1;
      } catch (error) {
        toast.error(`${file.name}: ${errorText(errors, error)}`);
      }
      setUploading((count) => count - 1);
    }
    if (uploaded === 0) return;
    toast.success(formatPlural(uploaded, dictionary.uploaded, lang));
    if (filters.page !== 1 || filters.search) setFilters({ page: 1, search: "" });
  }

  const upload_action = can_edit ? (
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
      <Button type="button" disabled={uploading > 0} onClick={() => input.current?.click()}>
        {uploading > 0 ? <Spinner /> : <UploadIcon />}
        {uploading > 0 ? formatPlural(uploading, dictionary.uploading, lang) : dictionary.upload}
      </Button>
    </>
  ) : undefined;

  const data = media.data;
  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="full" primary_action={upload_action}>
      <div
        className={cn(
          "bg-card flex flex-col gap-4 rounded-xl border p-4 transition-colors",
          is_dragging && "border-primary bg-primary/5",
        )}
        onDragOver={(event) => {
          if (!can_edit) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (!can_edit) return;
          event.preventDefault();
          setIsDragging(false);
          void onFiles([...event.dataTransfer.files]);
        }}
      >
        <form
          className="relative"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ search });
          }}
        >
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={search}
            placeholder={dictionary.search}
            aria-label={dictionary.search}
            className="pl-8"
            onChange={(event) => {
              setSearch(event.target.value);
              if (!event.target.value) setFilters({ search: "" });
            }}
          />
        </form>

        {media.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : media.isError ? (
          <p className="text-destructive text-sm">{errorText(errors, media.error)}</p>
        ) : data && data.items.length === 0 ? (
          filters.search ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {dictionary.no_results.replace("{query}", filters.search)}
            </p>
          ) : (
            <EmptyState
              icon={ImagesIcon}
              title={dictionary.empty_title}
              body={can_edit ? dictionary.empty_body : dictionary.empty_body_read_only}
              action={upload_action}
            />
          )
        ) : (
          <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6", media.isFetching && "opacity-70")}>
            {data?.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenItem(item)}
                  aria-label={dictionary.open.replace("{name}", item.name)}
                  className="focus-visible:ring-ring/50 hover:bg-muted/50 flex w-full flex-col overflow-hidden rounded-lg border text-left outline-none focus-visible:ring-3"
                >
                  <span className="bg-muted relative block aspect-square w-full">
                    <Image src={item.url} alt={item.alt} fill unoptimized sizes="12rem" className="object-contain" />
                  </span>
                  <span className="flex flex-col gap-0.5 px-2 py-1.5">
                    <span className="truncate text-xs font-medium">{item.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {[item.type.replace("image/", "").toUpperCase(), formatFileSize(item.size, lang)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {data && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{formatPlural(data.total_items, dictionary.count, lang)}</span>
            {data.total_pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters({ page: filters.page - 1 })}
                >
                  {common.previous}
                </Button>
                <span className="text-muted-foreground tabular-nums">
                  {dictionary.page.replace("{page}", String(filters.page)).replace("{total}", String(data.total_pages))}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= data.total_pages}
                  onClick={() => setFilters({ page: filters.page + 1 })}
                >
                  {common.next}
                </Button>
              </div>
            )}
          </div>
        )}
        {can_edit && <p className="text-muted-foreground text-xs">{dictionary.drop_hint}</p>}
      </div>

      <FileDetailsDialog
        lang={lang}
        item={open_item}
        can_edit={can_edit}
        onClose={() => setOpenItem(null)}
        dictionary={dictionary}
        confirm={confirm}
        common={common}
        errors={errors}
      />
    </Page>
  );
}
