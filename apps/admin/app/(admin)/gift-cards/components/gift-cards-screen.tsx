"use client";

import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { IndexTable, type IndexColumn, type IndexView } from "@repo/admin-ui/components/index-table";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge, type StatusTone } from "@repo/admin-ui/components/status-badge";
import type { GiftCard } from "@repo/core/backend/types";
import { useGiftCard, useGiftCards, useIssueGiftCard, useSetGiftCardActive } from "@repo/core/hooks/use-gift-cards";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  gift_card_filters_schema,
  giftCardStatus,
  issue_gift_card_schema,
  maskGiftCardCode,
  type GiftCardFilters,
  type GiftCardStatus,
} from "@repo/core/lib/schemas/gift-cards";
import { formatCurrency, formatDate, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { fromZonedInput } from "@repo/core/lib/utils/zoned-input";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
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
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";

const STATUS_TONE: Record<GiftCardStatus, StatusTone> = {
  active: "success",
  used: "neutral",
  expired: "neutral",
  disabled: "attention",
};
const VIEWS = ["all", "active", "used", "expired", "disabled"] as const;

type GiftCardsScreenProps = {
  lang: string;
  currency: string;
  time_zone: string;
  can_edit: boolean;
  dictionary: AdminDictionary["gift_cards"];
  index_table: AdminDictionary["admin_ui"]["index_table"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

function codeForPeople(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export function GiftCardsScreen({
  lang,
  currency,
  time_zone,
  can_edit,
  dictionary,
  index_table,
  common,
  errors,
}: GiftCardsScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search_params = useSearchParams();
  const filters = gift_card_filters_schema.parse(Object.fromEntries(search_params));
  const cards = useGiftCards(filters);
  const [is_issue_open, setIsIssueOpen] = useState(false);
  const [open_id, setOpenId] = useState<string | null>(null);
  const money = (cents: number, card_currency = currency) => formatCurrency(cents, card_currency || currency, lang);

  function setFilters(patch: Partial<GiftCardFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const views: IndexView[] = VIEWS.map((key) => ({ key, label: dictionary.views[key] }));
  const columns: IndexColumn<GiftCard>[] = [
    {
      key: "code",
      header: dictionary.columns.code,
      is_primary: true,
      // The row opens the card (onRowClick), so the cell is plain text.
      cell: (card) => <span className="font-mono text-sm">{maskGiftCardCode(card.code)}</span>,
    },
    {
      key: "status",
      header: dictionary.columns.status,
      min_width: "sm",
      cell: (card) => {
        const status = giftCardStatus(card);
        return <StatusBadge tone={STATUS_TONE[status]}>{dictionary.status[status]}</StatusBadge>;
      },
    },
    {
      key: "customer",
      header: dictionary.columns.customer,
      min_width: "md",
      cell: (card) => card.customer_email || "—",
    },
    {
      key: "expires",
      header: dictionary.columns.expires,
      min_width: "lg",
      cell: (card) => (card.expires_at ? formatDate(card.expires_at, lang) : dictionary.never),
    },
    {
      key: "balance",
      header: dictionary.columns.balance,
      align: "end",
      cell: (card) => `${money(card.balance, card.currency)} / ${money(card.initial_value, card.currency)}`,
    },
  ];

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="full"
      primary_action={
        can_edit ? (
          <Button type="button" onClick={() => setIsIssueOpen(true)}>
            <PlusIcon />
            {dictionary.issue}
          </Button>
        ) : undefined
      }
    >
      <IndexTable
        lang={lang}
        rows={cards.data?.items ?? []}
        getRowId={(card) => card.id}
        onRowClick={(card) => setOpenId(card.id)}
        columns={columns}
        resource_label={dictionary.title}
        views={views}
        active_view={filters.status}
        onViewChange={(key) => {
          const status = VIEWS.find((item) => item === key);
          if (status) setFilters({ status });
        }}
        search={filters.search}
        onSearchChange={(search) => setFilters({ search })}
        search_placeholder={dictionary.search_placeholder}
        page={cards.data?.page ?? filters.page}
        total_pages={cards.data?.total_pages ?? 1}
        onPageChange={(page) => setFilters({ page })}
        summary={cards.data ? formatPlural(cards.data.total_items, dictionary.results, lang) : undefined}
        is_loading={cards.isFetching}
        empty_state={
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="font-medium">{dictionary.empty_title}</p>
            <p className="text-muted-foreground max-w-md text-sm">{dictionary.empty_body}</p>
          </div>
        }
        dictionary={index_table}
      />
      {cards.isError && <p className="text-destructive text-sm">{errorText(errors, cards.error)}</p>}

      <IssueDialog
        is_open={is_issue_open}
        onOpenChange={setIsIssueOpen}
        currency={currency}
        time_zone={time_zone}
        lang={lang}
        dictionary={dictionary}
        common={common}
        errors={errors}
      />
      <CardDialog
        id={open_id}
        onClose={() => setOpenId(null)}
        lang={lang}
        can_edit={can_edit}
        money={money}
        dictionary={dictionary}
        errors={errors}
      />
    </Page>
  );
}

function IssueDialog({
  is_open,
  onOpenChange,
  currency,
  time_zone,
  lang,
  dictionary,
  common,
  errors,
}: {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  currency: string;
  time_zone: string;
  lang: string;
  dictionary: AdminDictionary["gift_cards"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
}) {
  const issue = useIssueGiftCard();
  const [amount, setAmount] = useState(5000);
  const [expires, setExpires] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [is_notify, setIsNotify] = useState(true);
  const [issued_code, setIssuedCode] = useState("");
  const input = {
    amount,
    expires_at: expires ? fromZonedInput(`${expires}T23:59`, time_zone) : "",
    customer_email: email.trim(),
    note,
    is_notify: is_notify && Boolean(email.trim()),
  };
  const parsed = issue_gift_card_schema.safeParse(input);

  function close() {
    onOpenChange(false);
    setIssuedCode("");
  }

  return (
    <Dialog open={is_open} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dictionary.issue}</DialogTitle>
          <DialogDescription>{dictionary.issue_hint}</DialogDescription>
        </DialogHeader>
        {issued_code ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">{dictionary.issued}</p>
            <CodeBox code={issued_code} label={dictionary.copy} />
            <DialogFooter>
              <Button type="button" onClick={close}>
                {common.close}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="gift-amount">{dictionary.amount}</FieldLabel>
              <MoneyInput
                id="gift-amount"
                cents={amount}
                onChange={setAmount}
                currency={currency}
                lang={lang}
                className="max-w-48"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="gift-expires">{dictionary.expires}</FieldLabel>
              <Input
                id="gift-expires"
                type="date"
                value={expires}
                className="max-w-48"
                onChange={(event) => setExpires(event.target.value)}
              />
              <FieldDescription>{dictionary.expires_hint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="gift-email">{dictionary.customer_email}</FieldLabel>
              <Input id="gift-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            {email.trim() && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={is_notify} onCheckedChange={(checked) => setIsNotify(checked === true)} />
                {dictionary.notify}
              </label>
            )}
            <Field>
              <FieldLabel htmlFor="gift-note">{dictionary.note}</FieldLabel>
              <Textarea
                id="gift-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {common.cancel}
              </Button>
              <Button
                type="button"
                disabled={!parsed.success || issue.isPending}
                onClick={() =>
                  parsed.success &&
                  issue.mutate(parsed.data, {
                    onSuccess: (card) => {
                      setIssuedCode(card.code);
                      toast.success(dictionary.issued);
                    },
                    onError: (error) => toast.error(errorText(errors, error)),
                  })
                }
              >
                {issue.isPending && <Spinner />}
                {dictionary.issue}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CodeBox({ code, label }: { code: string; label: string }) {
  const [is_copied, setIsCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="bg-muted flex-1 rounded-md px-3 py-2 text-center font-mono text-base tracking-wider">
        {codeForPeople(code)}
      </code>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        onClick={() => void navigator.clipboard.writeText(codeForPeople(code)).then(() => setIsCopied(true))}
      >
        {is_copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}

function CardDialog({
  id,
  onClose,
  lang,
  can_edit,
  money,
  dictionary,
  errors,
}: {
  id: string | null;
  onClose: () => void;
  lang: string;
  can_edit: boolean;
  money: (cents: number, currency?: string) => string;
  dictionary: AdminDictionary["gift_cards"];
  errors: AdminDictionary["errors"];
}) {
  const card = useGiftCard(id);
  const set_active = useSetGiftCardActive();
  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dictionary.card_title}</DialogTitle>
          <DialogDescription>{dictionary.card_hint}</DialogDescription>
        </DialogHeader>
        {!card.data ? (
          <Skeleton className="h-40 rounded-md" />
        ) : (
          <div className="flex flex-col gap-4">
            {can_edit ? (
              <CodeBox code={card.data.code} label={dictionary.copy} />
            ) : (
              <p className="font-mono">{maskGiftCardCode(card.data.code)}</p>
            )}
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{dictionary.columns.balance}</dt>
              <dd className="text-right tabular-nums">{money(card.data.balance, card.data.currency)}</dd>
              <dt className="text-muted-foreground">{dictionary.initial_value}</dt>
              <dd className="text-right tabular-nums">{money(card.data.initial_value, card.data.currency)}</dd>
              <dt className="text-muted-foreground">{dictionary.columns.expires}</dt>
              <dd className="text-right">
                {card.data.expires_at ? formatDate(card.data.expires_at, lang) : dictionary.never}
              </dd>
              <dt className="text-muted-foreground">{dictionary.columns.customer}</dt>
              <dd className="truncate text-right">{card.data.customer_email || "—"}</dd>
            </dl>
            {can_edit && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch
                  checked={card.data.is_active}
                  disabled={set_active.isPending}
                  aria-label={dictionary.is_active}
                  onCheckedChange={(is_active) =>
                    set_active.mutate(
                      { id: card.data.id, is_active },
                      {
                        onError: (error) => toast.error(errorText(errors, error)),
                        onSuccess: () => void card.refetch(),
                      },
                    )
                  }
                />
                {dictionary.is_active}
              </label>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{dictionary.history}</p>
              <ul className="divide-y text-sm">
                {card.data.transactions.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="flex flex-col">
                      <span className="text-muted-foreground text-xs">{formatDateTime(item.created_at, lang)}</span>
                      {item.note && <span className="text-xs">{item.note}</span>}
                    </span>
                    <span className="tabular-nums">
                      {item.amount > 0 ? "+" : "−"}
                      {money(Math.abs(item.amount), card.data.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
