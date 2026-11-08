"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { createApiKey, getApiKeys, revokeApiKey } from "@repo/core/actions/api-keys";
import type { ApiKey } from "@repo/core/backend/types";
import { errorText, unwrap } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { formatDateTime, formatRelativeTime } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type ApiKeysScreenProps = {
  lang: string;
  endpoint: string;
  can_edit: boolean;
  dictionary: AdminDictionary["api_keys"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

export function ApiKeysScreen({ lang, endpoint, can_edit, dictionary, common, errors }: ApiKeysScreenProps) {
  const query_client = useQueryClient();
  const keys = useQuery({ queryKey: query_keys.api_keys, queryFn: async () => unwrap(await getApiKeys()) });
  const invalidate = () => query_client.invalidateQueries({ queryKey: query_keys.api_keys });
  const revoke = useMutation({
    mutationFn: async (id: string) => unwrap(await revokeApiKey(id)),
    onSuccess: invalidate,
  });
  const [is_create_open, setIsCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="narrow"
      primary_action={
        can_edit ? (
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <PlusIcon />
            {dictionary.create}
          </Button>
        ) : undefined
      }
    >
      <SectionCard title={dictionary.connect_title}>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">{dictionary.connect_body}</p>
          <CopyBox value={endpoint} label={dictionary.copy} />
          <p className="text-muted-foreground">{dictionary.connect_header}</p>
        </div>
      </SectionCard>

      <SectionCard title={dictionary.keys_title}>
        {keys.isPending ? (
          <Skeleton className="h-24 rounded-md" />
        ) : keys.isError ? (
          <p className="text-destructive text-sm">{errorText(errors, keys.error)}</p>
        ) : keys.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">{dictionary.empty}</p>
        ) : (
          <ul className="divide-y">
            {keys.data.map((key) => (
              <li key={key.id} className="flex items-center gap-3 py-3">
                <KeyRoundIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {key.name}
                    {key.revoked_at && <StatusBadge tone="neutral">{dictionary.revoked}</StatusBadge>}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    <code className="font-mono">{key.key_prefix}…</code> · {key.user_email} ·{" "}
                    <span title={formatDateTime(key.created_at, lang)}>
                      {dictionary.created.replace("{when}", formatRelativeTime(key.created_at, lang))}
                    </span>{" "}
                    ·{" "}
                    {key.last_used_at
                      ? dictionary.last_used.replace("{when}", formatRelativeTime(key.last_used_at, lang))
                      : dictionary.never_used}
                  </span>
                </div>
                {can_edit && !key.revoked_at && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setRevoking(key)}>
                    {dictionary.revoke}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <CreateDialog
        is_open={is_create_open}
        onOpenChange={setIsCreateOpen}
        onCreated={invalidate}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
      <ConfirmDialog
        is_open={revoking !== null}
        onOpenChange={(is_open) => !is_open && setRevoking(null)}
        title={dictionary.revoke_title}
        body={dictionary.revoke_body.replace("{name}", revoking?.name ?? "")}
        confirm_label={dictionary.revoke}
        cancel_label={common.cancel}
        is_destructive
        is_pending={revoke.isPending}
        onConfirm={() =>
          revoking &&
          revoke.mutate(revoking.id, {
            onSuccess: () => {
              toast.success(dictionary.revoked_toast);
              setRevoking(null);
            },
            onError: (error) => toast.error(errorText(errors, error)),
          })
        }
      />
    </Page>
  );
}

function CreateDialog({
  is_open,
  onOpenChange,
  onCreated,
  dictionary,
  common,
  errors,
}: {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  onCreated: () => void;
  dictionary: AdminDictionary["api_keys"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
}) {
  const create = useMutation({ mutationFn: async (name: string) => unwrap(await createApiKey({ name })) });
  const [name, setName] = useState("");
  const [created_key, setCreatedKey] = useState("");

  function close() {
    onOpenChange(false);
    setName("");
    setCreatedKey("");
  }

  return (
    <Dialog open={is_open} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dictionary.create}</DialogTitle>
          <DialogDescription>{created_key ? dictionary.created_hint : dictionary.create_hint}</DialogDescription>
        </DialogHeader>
        {created_key ? (
          <>
            <CopyBox value={created_key} label={dictionary.copy} />
            <DialogFooter>
              <Button type="button" onClick={close}>
                {common.close}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate(name.trim(), {
                onSuccess: (result) => {
                  setCreatedKey(result.key);
                  onCreated();
                },
                onError: (error) => toast.error(errorText(errors, error)),
              });
            }}
          >
            <Field>
              <FieldLabel htmlFor="api-key-name">{dictionary.name}</FieldLabel>
              <Input
                id="api-key-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder={dictionary.name_placeholder}
              />
              <FieldDescription>{dictionary.name_hint}</FieldDescription>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {common.cancel}
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending && <Spinner />}
                {dictionary.create}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyBox({ value, label }: { value: string; label: string }) {
  const [is_copied, setIsCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 font-mono text-xs">{value}</code>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        onClick={() => void navigator.clipboard.writeText(value).then(() => setIsCopied(true))}
      >
        {is_copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
