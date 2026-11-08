"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BanknoteIcon,
  CreditCardIcon,
  LandmarkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MethodDialog } from "./method-dialog";
import { StripeCard } from "./stripe-card";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { isLocale, LOCALES } from "@repo/core/i18nConfig";
import { usePaymentsOverview, useSavePaymentMethods } from "@repo/core/hooks/use-payments";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { MAX_PAYMENT_METHODS, type PaymentMethodConfig } from "@repo/core/lib/schemas/payments";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";

type PaymentsScreenProps = {
  lang: string;
  currency: string;
  can_edit: boolean;
  dictionary: AdminDictionary["payments"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
};

const ICONS = { stripe: CreditCardIcon, cash_on_delivery: BanknoteIcon, manual: LandmarkIcon } as const;

export function PaymentsScreen(props: PaymentsScreenProps) {
  const overview = usePaymentsOverview();
  if (overview.isPending) {
    return (
      <Page title={props.dictionary.title} subtitle={props.dictionary.subtitle} width="narrow">
        <Skeleton className="h-64 rounded-xl" />
      </Page>
    );
  }
  if (overview.isError) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(props.errors, overview.error)}</p>
      </Page>
    );
  }
  // Mounted again after each save, so the list starts from what's stored.
  return <PaymentsForm key={JSON.stringify(overview.data.methods)} {...props} overview={overview.data} />;
}

function PaymentsForm({
  lang,
  currency,
  can_edit,
  dictionary,
  common,
  errors,
  save_bar,
  overview,
}: PaymentsScreenProps & { overview: NonNullable<ReturnType<typeof usePaymentsOverview>["data"]> }) {
  const save = useSavePaymentMethods();
  const [methods, setMethods] = useState(overview.methods);
  const [editing, setEditing] = useState<PaymentMethodConfig | null>(null);
  const [is_dialog_open, setIsDialogOpen] = useState(false);
  const locale = isLocale(lang) ? lang : LOCALES[0];
  const is_dirty = JSON.stringify(methods) !== JSON.stringify(overview.methods);
  const has_stripe = methods.some((method) => method.type === "stripe");

  const update = (id: string, change: (method: PaymentMethodConfig) => PaymentMethodConfig) =>
    setMethods((list) => list.map((method) => (method.id === id ? change(method) : method)));

  function move(index: number, to: number) {
    if (to < 0 || to >= methods.length) return;
    const next = [...methods];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    setMethods(next);
  }

  function openDialog(method: PaymentMethodConfig) {
    setEditing(method);
    setIsDialogOpen(true);
  }

  function addManual() {
    const method: PaymentMethodConfig = {
      id: `manual_${Math.random().toString(36).slice(2, 8)}`,
      type: "manual",
      is_enabled: true,
      name: { [locale]: dictionary.new_manual_name },
      instructions: {},
      fee: 0,
    };
    setMethods((list) => [...list, method]);
    openDialog(method);
  }

  function addStripe() {
    setMethods((list) => [
      ...list,
      {
        id: "stripe",
        type: "stripe",
        is_enabled: true,
        name: { [locale]: dictionary.types.stripe },
        instructions: {},
        fee: 0,
      },
    ]);
  }

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="narrow">
      <SectionCard
        title={dictionary.methods_title}
        description={dictionary.methods_hint}
        is_flush
        action={
          can_edit &&
          methods.length < MAX_PAYMENT_METHODS && (
            <Button type="button" variant="outline" size="sm" onClick={addManual}>
              <PlusIcon />
              {dictionary.add_manual}
            </Button>
          )
        }
      >
        <ul className="divide-y border-t">
          {methods.map((method, index) => {
            const Icon = ICONS[method.type];
            const is_card_not_ready = method.type === "stripe" && !overview.stripe.is_ready;
            return (
              <li key={method.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{localized(method.name, locale) || method.id}</span>
                    <StatusBadge tone="neutral">{dictionary.types[method.type]}</StatusBadge>
                    {is_card_not_ready && method.is_enabled && (
                      <StatusBadge tone="attention">{dictionary.stripe.needs_keys}</StatusBadge>
                    )}
                  </div>
                  {method.fee > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {dictionary.fee_value.replace("{amount}", formatCurrency(method.fee, currency, lang))}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {can_edit && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.move_up}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.move_down}
                        disabled={index === methods.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.edit}
                        onClick={() => openDialog(method)}
                      >
                        <PencilIcon />
                      </Button>
                      {method.type === "manual" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={dictionary.remove}
                          onClick={() => setMethods((list) => list.filter((item) => item.id !== method.id))}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </>
                  )}
                  <Switch
                    checked={method.is_enabled}
                    disabled={!can_edit}
                    aria-label={dictionary.enabled.replace("{name}", localized(method.name, locale) || method.id)}
                    onCheckedChange={(is_enabled) => update(method.id, (item) => ({ ...item, is_enabled }))}
                    className="ml-2"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {can_edit && !has_stripe && (
          <div className="border-t px-5 py-3">
            <Button type="button" variant="link" size="sm" className="px-0" onClick={addStripe}>
              {dictionary.add_stripe}
            </Button>
          </div>
        )}
      </SectionCard>

      {has_stripe && <StripeCard overview={overview} can_edit={can_edit} dictionary={dictionary} errors={errors} />}

      <MethodDialog
        method={editing}
        is_open={is_dialog_open}
        onOpenChange={setIsDialogOpen}
        onSave={(method) => update(method.id, () => method)}
        lang={lang}
        currency={currency}
        dictionary={dictionary}
        common={common}
      />
      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={save.isPending}
          onDiscard={() => setMethods(overview.methods)}
          onSave={() =>
            save.mutate(methods, {
              onSuccess: () => toast.success(dictionary.saved),
              onError: (error) => toast.error(errorText(errors, error)),
            })
          }
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}
