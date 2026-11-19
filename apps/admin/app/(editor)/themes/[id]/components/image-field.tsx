"use client";

import { ImageIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { TextInputField, type EditorContext } from "./editor-fields";
import { MediaPicker } from "@/components/media-picker";
import { useUploadMedia } from "@repo/core/hooks/use-media";
import { errorText } from "@repo/core/lib/action-result";
import { Button } from "@repo/ui/components/ui/button";
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

// An image for a section: upload one, pick one from Content → Files, or paste a link. Uploaded images keep their URL, so the same photo can be used in several sections.
export function ImageField({ id, label, value, onChange, description, invalid_label, context }: ImageFieldProps) {
  const text = context.media;
  const upload = useUploadMedia();
  const input = useRef<HTMLInputElement>(null);
  const [is_library_open, setIsLibraryOpen] = useState(false);

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

      <MediaPicker
        is_open={is_library_open}
        onOpenChange={setIsLibraryOpen}
        mode="single"
        onPick={([item]) => item && onChange(item.url)}
        can_upload={!context.is_disabled}
        lang={context.lang}
        dictionary={context.files_picker}
        errors={context.errors}
      />
    </div>
  );
}
