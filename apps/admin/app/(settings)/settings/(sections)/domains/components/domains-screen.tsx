"use client";

import { GlobeIcon, MoreHorizontalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AddDomainDialog } from "./add-domain-dialog";
import { DnsRecords } from "./dns-records";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { AdminDomain } from "@repo/core/actions/domains";
import {
  useCheckDomain,
  useClearPrimaryDomain,
  useDomains,
  useRemoveDomain,
  useSetPrimaryDomain,
} from "@repo/core/hooks/use-domains";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { DOMAIN_TARGETS, type DomainStatus, type DomainTarget } from "@repo/core/lib/schemas/domains";
import { formatRelativeTime } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

const STATUS_TONE: Record<DomainStatus, StatusTone> = {
  pending: "attention",
  verifying: "info",
  active: "success",
  error: "critical",
};

type DomainsScreenProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["domains"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

export function DomainsScreen({ lang, can_edit, dictionary, common, errors, validation }: DomainsScreenProps) {
  const domains = useDomains();
  const check = useCheckDomain();
  const set_primary = useSetPrimaryDomain();
  const clear_primary = useClearPrimaryDomain();
  const remove = useRemoveDomain();
  const [add_target, setAddTarget] = useState<DomainTarget | null>(null);
  // Open records panels; a newly added domain opens its own.
  const [open_records, setOpenRecords] = useState<Set<string>>(new Set());
  // The domain stays set while the dialog fades out, so its title doesn't go blank.
  const [pending_remove, setPendingRemove] = useState<AdminDomain | null>(null);
  const [is_remove_open, setIsRemoveOpen] = useState(false);

  const onError = (error: unknown) => toast.error(errorText(errors, error));

  function toggleRecords(id: string) {
    setOpenRecords((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmRemove() {
    if (!pending_remove) return;
    remove.mutate(pending_remove.id, {
      onSuccess: () => {
        toast.success(dictionary.removed);
        setIsRemoveOpen(false);
      },
      onError,
    });
  }

  if (domains.isPending) {
    return (
      <Page title={dictionary.title} subtitle={dictionary.subtitle} width="narrow">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </Page>
    );
  }
  if (domains.isError) {
    return (
      <Page title={dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(errors, domains.error)}</p>
      </Page>
    );
  }

  const { setup, current_hosts } = domains.data;
  const setup_text =
    setup.missing_env.length > 0
      ? dictionary.setup.missing.replace("{provider}", setup.requested).replace("{names}", setup.missing_env.join(", "))
      : dictionary.setup[setup.provider];

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="narrow">
      <p className="bg-muted/50 text-muted-foreground rounded-lg px-4 py-3 text-sm">{setup_text}</p>

      {DOMAIN_TARGETS.map((target) => {
        const list = domains.data.domains.filter((domain) => domain.target === target);
        const primary = list.find((domain) => domain.is_primary);
        return (
          <SectionCard
            key={target}
            title={dictionary.targets[target]}
            description={dictionary.target_hint[target]}
            is_flush
            action={
              can_edit && (
                <Button type="button" variant="outline" size="sm" onClick={() => setAddTarget(target)}>
                  <PlusIcon />
                  {dictionary.add}
                </Button>
              )
            }
            footer={
              primary ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {dictionary.primary_hint.replace("{domain}", primary.hostname)}
                  </span>
                  {can_edit && (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      disabled={clear_primary.isPending}
                      onClick={() =>
                        clear_primary.mutate(target, {
                          onSuccess: () => toast.success(dictionary.primary_cleared),
                          onError,
                        })
                      }
                    >
                      {dictionary.stop_redirecting}
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">{dictionary.no_primary}</span>
              )
            }
          >
            <ul className="divide-y border-t">
              {/* The address the app answers on today (its hosting address or NEXT_PUBLIC_*_URL). */}
              <li className="flex items-center gap-3 px-4 py-3">
                <GlobeIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{current_hosts[target]}</span>
                  <span className="text-muted-foreground text-xs">{dictionary.current_address}</span>
                </span>
              </li>
              {list.map((domain) => {
                const is_open = open_records.has(domain.id) || domain.status === "pending";
                const is_checking = check.isPending && check.variables === domain.id;
                return (
                  <li key={domain.id} className="flex flex-col gap-3 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`https://${domain.hostname}`}
                            target="_blank"
                            rel="noopener"
                            className="truncate font-medium hover:underline"
                          >
                            {domain.hostname}
                          </a>
                          <StatusBadge tone={STATUS_TONE[domain.status]}>
                            {dictionary.statuses[domain.status]}
                          </StatusBadge>
                          {domain.is_primary && (
                            <StatusBadge tone="neutral" has_dot={false}>
                              {dictionary.primary}
                            </StatusBadge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">{dictionary.status_hints[domain.status]}</p>
                        {domain.last_error && (
                          <p className="text-destructive text-xs break-words">{domain.last_error}</p>
                        )}
                        {domain.last_checked_at && (
                          <p className="text-muted-foreground text-xs">
                            {dictionary.checked.replace("{time}", formatRelativeTime(domain.last_checked_at, lang))}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={is_checking}
                          onClick={() => check.mutate(domain.id, { onError })}
                        >
                          {is_checking ? <Spinner aria-hidden /> : <RefreshCwIcon />}
                          <span className="sr-only sm:not-sr-only">{dictionary.check_now}</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={dictionary.more}>
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => toggleRecords(domain.id)}>
                              {is_open ? dictionary.hide_records : dictionary.show_records}
                            </DropdownMenuItem>
                            {can_edit && !domain.is_primary && (
                              <DropdownMenuItem
                                disabled={domain.status !== "active" || set_primary.isPending}
                                onSelect={() =>
                                  set_primary.mutate(domain.id, {
                                    onSuccess: () => toast.success(dictionary.primary_set),
                                    onError,
                                  })
                                }
                              >
                                {dictionary.set_primary}
                              </DropdownMenuItem>
                            )}
                            {can_edit && !domain.is_primary && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => {
                                    setPendingRemove(domain);
                                    setIsRemoveOpen(true);
                                  }}
                                >
                                  {dictionary.remove}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {is_open && <DnsRecords records={domain.dns_records} dictionary={dictionary} />}
                  </li>
                );
              })}
              {list.length === 0 && <li className="text-muted-foreground px-4 py-3 text-sm">{dictionary.empty}</li>}
            </ul>
          </SectionCard>
        );
      })}

      <p className="text-muted-foreground text-xs">{dictionary.url_reminder}</p>

      <AddDomainDialog
        is_open={add_target !== null}
        onOpenChange={(is_open) => !is_open && setAddTarget(null)}
        default_target={add_target ?? "store"}
        onAdded={(id) => setOpenRecords((current) => new Set(current).add(id))}
        dictionary={dictionary}
        common={common}
        errors={errors}
        validation={validation}
      />
      <ConfirmDialog
        is_open={is_remove_open}
        onOpenChange={setIsRemoveOpen}
        title={dictionary.remove_title.replace("{domain}", pending_remove?.hostname ?? "")}
        body={dictionary.remove_body}
        confirm_label={dictionary.remove}
        cancel_label={common.cancel}
        onConfirm={confirmRemove}
        is_pending={remove.isPending}
        is_destructive
      />
    </Page>
  );
}
