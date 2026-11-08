"use client";

import Image from "next/image";
import { useRef } from "react";
import { toast } from "sonner";

import { useUploadSiteAsset } from "@repo/core/hooks/use-admin";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { SiteAssetKind } from "@repo/core/lib/schemas/admin";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";

type AssetInputProps = {
  id: string;
  label: string;
  kind: SiteAssetKind;
  value: unknown;
  onChange: (value: unknown) => void;
  is_disabled: boolean;
  dictionary: AdminDictionary["settings"];
  errors: AdminDictionary["errors"];
};

// Uploads a logo or favicon file and hands the resulting URL back to the section's draft; the
// section's SaveBar then stores it in the setting (audit S2).
export function AssetInput({ id, label, kind, value, onChange, is_disabled, dictionary, errors }: AssetInputProps) {
  const upload = useUploadSiteAsset();
  const file_input = useRef<HTMLInputElement>(null);
  const url = typeof value === "string" ? value : "";

  function pick(file: File | undefined) {
    if (!file) return;
    const form_data = new FormData();
    form_data.set("kind", kind);
    form_data.set("file", file);
    upload.mutate(form_data, {
      onSuccess: (result) => onChange(result.url),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {url ? (
        <Image
          src={url}
          alt={label}
          width={64}
          height={64}
          className="bg-muted size-16 rounded-md border object-contain"
        />
      ) : (
        <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-md border p-2 text-center text-xs">
          {dictionary.assets.empty}
        </span>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={is_disabled || upload.isPending}
          onClick={() => file_input.current?.click()}
        >
          {upload.isPending && <Spinner aria-hidden />}
          {url ? dictionary.assets.replace : dictionary.assets.upload}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={is_disabled || upload.isPending}
            onClick={() => onChange("")}
          >
            {dictionary.assets.remove}
          </Button>
        )}
      </div>
      <input
        ref={file_input}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
        className="sr-only"
        aria-hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
