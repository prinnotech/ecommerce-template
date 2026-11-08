"use client";

import { ImageIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { TextInputField, type EditorContext } from "./editor-fields";
import { useMedia, useUploadMedia } from "@repo/core/hooks/use-pages";
import { errorText } from "@repo/core/lib/action-result";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

type ImageFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  invalid_label: string;
  context: EditorContext;
};

// An image for a section: upload one, pick one already uploaded (the media library), or paste a
// link. Uploaded images keep their URL, so the same photo can be used in several sections.
export function ImageField({ id, label, value, onChange, description, invalid_label, context }: ImageFieldProps) {
  const text = context.media;
  const upload = useUploadMedia();
  const input = useRef<HTMLInputElement>(null);
  const [is_library_open, setIsLibraryOpen] = useState(false);
  const media = useMedia(is_library_open);

  function onFile(file: File | undefined) {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (item) => {
        onChange(item.url);
        toast.success(text.uploaded);
      },
      onError: (error) => toast.error(errorText(context.errors, error)),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {value && (
        // The owner's link can point at any host, so the optimizer is skipped.
        <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-md border">
          <Image src={value} alt="" fill unoptimized sizes="24rem" className="object-cover" />
        </div>
      )}
      <TextInputField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        description={description}
        is_url
        invalid_label={invalid_label}
        context={context}
      />
      {!context.is_disabled && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {upload.isPending ? <Spinner /> : <UploadIcon />}
            {upload.isPending ? text.uploading : text.upload}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsLibraryOpen(true)}>
            <ImageIcon />
            {text.library}
          </Button>
        </div>
      )}

      <Dialog open={is_library_open} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{text.library_title}</DialogTitle>
            <DialogDescription>{text.library_body}</DialogDescription>
          </DialogHeader>
          {media.isPending ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : media.isError ? (
            <p className="text-destructive text-sm">{errorText(context.errors, media.error)}</p>
          ) : media.data.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{text.library_empty}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {media.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.url);
                      setIsLibraryOpen(false);
                    }}
                    className="focus-visible:ring-ring/50 block w-full overflow-hidden rounded-md border outline-none focus-visible:ring-3"
                    aria-label={text.choose.replace("{name}", item.name)}
                  >
                    <span className="bg-muted relative block aspect-square w-full">
                      <Image src={item.url} alt="" fill unoptimized sizes="10rem" className="object-cover" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
