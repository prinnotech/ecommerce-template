"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import type { MediaItem } from "@repo/core/actions/media";
import { TextField } from "@repo/core/components/form-field";
import { useDeleteMedia, useUpdateMedia } from "@repo/core/hooks/use-media";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { update_media_schema } from "@repo/core/lib/schemas/media";
import { formatDateTime, formatFileSize } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";

type FileDetailsDialogProps = {
  lang: string;
  // null = closed.
  item: MediaItem | null;
  can_edit: boolean;
  onClose: () => void;
  dictionary: AdminDictionary["files"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

export function FileDetailsDialog(props: FileDetailsDialogProps) {
  return (
    <Dialog open={props.item !== null} onOpenChange={(is_open) => !is_open && props.onClose()}>
      {props.item && <FileDetails {...props} item={props.item} />}
    </Dialog>
  );
}

function FileDetails({
  lang,
  item,
  can_edit,
  onClose,
  dictionary,
  confirm,
  common,
  errors,
}: FileDetailsDialogProps & { item: MediaItem }) {
  const update = useUpdateMedia();
  const remove = useDeleteMedia();
  const [name, setName] = useState(item.name);
  const [alt, setAlt] = useState(item.alt);
  const [is_copied, setIsCopied] = useState(false);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const parsed = update_media_schema.safeParse({ id: item.id, name, alt });
  const is_dirty = name !== item.name || alt !== item.alt;
  // Relative links (local storage) are shown and copied as full URLs.
  const link = typeof window === "undefined" ? item.url : new URL(item.url, window.location.origin).toString();

  function save() {
    if (!parsed.success) return;
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(dictionary.saved);
        onClose();
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="truncate pr-6">{item.name}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg border">
          <Image src={item.url} alt={item.alt} fill unoptimized sizes="20rem" className="object-contain" />
        </div>
        <div className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            <TextField
              name="name"
              id="file-name"
              label={dictionary.name}
              value={name}
              maxLength={200}
              disabled={!can_edit}
              error={!name.trim() ? dictionary.name_required : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              name="alt"
              id="file-alt"
              label={dictionary.alt}
              description={dictionary.alt_hint}
              value={alt}
              maxLength={500}
              disabled={!can_edit}
              onChange={(event) => setAlt(event.target.value)}
            />
          </FieldGroup>
          <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <dt>{dictionary.type}</dt>
            <dd className="text-foreground">{item.type.replace("image/", "").toUpperCase() || "—"}</dd>
            <dt>{dictionary.size}</dt>
            <dd className="text-foreground">{formatFileSize(item.size, lang)}</dd>
            <dt>{dictionary.uploaded_at}</dt>
            <dd className="text-foreground">{formatDateTime(item.created_at, lang)}</dd>
          </dl>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{dictionary.link}</span>
            <code className="bg-muted rounded-md px-2 py-1.5 text-xs break-all">{link}</code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(link).then(() => setIsCopied(true))}
              >
                {is_copied ? <CheckIcon /> : <CopyIcon />}
                {is_copied ? dictionary.copied : dictionary.copy_link}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={link} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  {dictionary.open_original}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        {can_edit ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setIsDeleteOpen(true)}>
            <Trash2Icon />
            {dictionary.delete}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
            {common.close}
          </Button>
          {can_edit && (
            <Button type="button" onClick={save} disabled={!is_dirty || !parsed.success || update.isPending}>
              {update.isPending && <Spinner aria-label={common.loading} />}
              {common.save}
            </Button>
          )}
        </div>
      </DialogFooter>
      <ConfirmDialog
        is_open={is_delete_open}
        onOpenChange={setIsDeleteOpen}
        title={dictionary.delete_title}
        body={dictionary.delete_body}
        confirm_label={dictionary.delete}
        cancel_label={confirm.cancel}
        is_pending={remove.isPending}
        is_destructive
        onConfirm={() =>
          remove.mutate(item.id, {
            onSuccess: () => {
              toast.success(dictionary.deleted);
              setIsDeleteOpen(false);
              onClose();
            },
            onError: (error) => toast.error(errorText(errors, error)),
          })
        }
      />
    </DialogContent>
  );
}
