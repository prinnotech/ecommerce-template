"use client";

import { RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DISCOUNT_TONE, discountValueText } from "./discounts-table";
import { TargetPicker } from "./target-picker";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { DiscountView } from "@repo/core/actions/discounts";
import type { DiscountTarget } from "@repo/core/backend/types";
import { FormField } from "@repo/core/components/form-field";
import { useCreateDiscount, useDeleteDiscount, useUpdateDiscount } from "@repo/core/hooks/use-discounts";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  APPLIES_TO_ALL,
  COMBINES_WITH_NONE,
  DEFAULT_BUY_X_GET_Y,
  DISCOUNT_CLASSES,
  DISCOUNT_METHODS,
  DISCOUNT_TYPES,
  discount_input_schema,
  discountClass,
  discountStatus,
  generateDiscountCode,
  type BuyXGetY,
  type CombinesWith,
  type DiscountAppliesTo,
  type DiscountMethod,
  type DiscountType,
} from "@repo/core/lib/schemas/discounts";
import { formatCurrency, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { fromZonedInput, toZonedInput } from "@repo/core/lib/utils/zoned-input";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Switch } from "@repo/ui/components/ui/switch";

type DiscountEditorProps = {
  lang: string;
  currency: string;
  time_zone: string;
  can_edit: boolean;
  // null = a new discount.
  view: DiscountView | null;
  dictionary: AdminDictionary["discounts"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  errors: AdminDictionary["errors"];
};

// The form keeps dates as datetime-local text in the store's time zone.
type DiscountForm = {
  method: DiscountMethod;
  code: string;
  title: string;
  type: DiscountType;
  value: number;
  min_subtotal: number;
  starts_at: string;
  ends_at: string;
  usage_limit: number;
  once_per_customer: boolean;
  is_active: boolean;
  applies_to: DiscountAppliesTo;
  buy_x_get_y: BuyXGetY;
  combines_with: CombinesWith;
};

function initialForm(view: DiscountView | null, time_zone: string): DiscountForm {
  const discount = view?.discount;
  return {
    method: discount?.method ?? "code",
    code: discount?.code ?? "",
    title: discount?.title ?? "",
    type: discount?.type ?? "percent",
    value: discount?.value ?? 10,
    min_subtotal: discount?.min_subtotal ?? 0,
    starts_at: toZonedInput(discount?.starts_at ?? "", time_zone),
    ends_at: toZonedInput(discount?.ends_at ?? "", time_zone),
    usage_limit: discount?.usage_limit ?? 0,
    once_per_customer: discount?.once_per_customer ?? false,
    is_active: discount?.is_active ?? true,
    applies_to: discount?.applies_to ?? APPLIES_TO_ALL,
    buy_x_get_y: discount?.buy_x_get_y ?? DEFAULT_BUY_X_GET_Y,
    combines_with: discount?.combines_with ?? COMBINES_WITH_NONE,
  };
}

const DEFAULT_VALUE: Record<DiscountType, number> = { percent: 10, fixed: 500, free_shipping: 0, buy_x_get_y: 0 };

export function DiscountEditor({
  lang,
  currency,
  time_zone,
  can_edit,
  view,
  dictionary,
  confirm,
  save_bar,
  errors,
}: DiscountEditorProps) {
  const router = useRouter();
  const create = useCreateDiscount();
  const update = useUpdateDiscount(view?.discount.id ?? "");
  const remove = useDeleteDiscount();
  const initial = initialForm(view, time_zone);
  const [form, setForm] = useState<DiscountForm>(initial);
  const [names, setNames] = useState(
    () => new Map<string, DiscountTarget>((view?.targets ?? []).map((target) => [target.id, target])),
  );
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  // An empty code or title on a new discount isn't an error until the first save.
  const [is_submitted, setIsSubmitted] = useState(false);
  const set = (patch: Partial<DiscountForm>) => setForm((current) => ({ ...current, ...patch }));
  const setDeal = (patch: Partial<BuyXGetY>) => set({ buy_x_get_y: { ...form.buy_x_get_y, ...patch } });
  const is_locked = !can_edit;
  const is_new = view === null;
  const is_automatic = form.method === "automatic";
  const is_deal = form.type === "buy_x_get_y";
  const deal = form.buy_x_get_y;

  const input = {
    ...form,
    starts_at: fromZonedInput(form.starts_at, time_zone),
    ends_at: fromZonedInput(form.ends_at, time_zone),
    value: form.type === "free_shipping" || is_deal ? 0 : form.value,
    applies_to: is_deal || form.type === "free_shipping" ? APPLIES_TO_ALL : form.applies_to,
    buy_x_get_y: is_deal ? deal : null,
    usage_limit: is_automatic ? 0 : form.usage_limit,
    once_per_customer: is_automatic ? false : form.once_per_customer,
  };
  const parsed = discount_input_schema.safeParse(input);
  const is_dirty = is_new || JSON.stringify(form) !== JSON.stringify(initial);
  const issue = (path: keyof typeof dictionary.invalid) =>
    parsed.success || ((path === "code" || path === "title") && !is_submitted)
      ? undefined
      : parsed.error.issues.some((item) => item.path[0] === path)
        ? dictionary.invalid[path]
        : undefined;

  function pick(target?: DiscountTarget) {
    if (target) setNames((current) => new Map(current).set(target.id, target));
  }

  function setMethod(method: DiscountMethod) {
    // Automatic discounts get a hidden code on save; a code discount needs one typed.
    const has_hidden_code = form.code.startsWith("AUTO-");
    set({
      method,
      code: method === "automatic" ? (has_hidden_code ? form.code : "") : has_hidden_code ? "" : form.code,
    });
  }

  function onSave() {
    setIsSubmitted(true);
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    const callbacks = { onError: (error: Error) => toast.error(errorText(errors, error)) };
    if (is_new) {
      create.mutate(parsed.data, {
        ...callbacks,
        onSuccess: ({ id }) => {
          toast.success(dictionary.saved);
          router.replace(`/discounts/${id}`);
        },
      });
    } else {
      update.mutate(parsed.data, {
        ...callbacks,
        onSuccess: () => {
          toast.success(dictionary.saved);
          router.refresh();
        },
      });
    }
  }

  const status = view ? discountStatus(view.discount) : null;
  const own_class = discountClass({ type: form.type, applies_to: input.applies_to });
  const combines = DISCOUNT_CLASSES.filter((item) => form.combines_with[item]).map(
    (item) => dictionary.combine.classes[item],
  );
  const summary = [
    ...(is_automatic ? [dictionary.summary.automatic] : []),
    discountValueText(
      { type: form.type, value: form.value, buy_x_get_y: is_deal ? deal : null },
      currency,
      lang,
      dictionary,
    ),
    ...(is_deal
      ? deal.max_uses > 0
        ? [formatPlural(deal.max_uses, dictionary.summary.max_uses, lang)]
        : []
      : form.type === "free_shipping"
        ? []
        : [
            form.applies_to.kind === "all"
              ? dictionary.summary.whole_order
              : formatPlural(form.applies_to.ids.length, dictionary.summary[form.applies_to.kind], lang),
          ]),
    form.min_subtotal > 0
      ? dictionary.summary.minimum.replace("{amount}", formatCurrency(form.min_subtotal, currency, lang))
      : dictionary.summary.no_minimum,
    ...(is_automatic
      ? []
      : [
          form.usage_limit > 0
            ? dictionary.summary.limit.replace("{count}", String(form.usage_limit))
            : dictionary.summary.no_limit,
          ...(form.once_per_customer ? [dictionary.summary.once_per_customer] : []),
        ]),
    combines.length > 0
      ? dictionary.summary.combines.replace("{list}", combines.join(", "))
      : dictionary.summary.combines_none,
  ];

  const main = (
    <>
      <SectionCard title={dictionary.method_title}>
        <div role="radiogroup" aria-label={dictionary.method_title} className="mb-2 grid gap-2 sm:grid-cols-2">
          {DISCOUNT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={form.method === method}
              disabled={is_locked}
              onClick={() => setMethod(method)}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60",
                form.method === method ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <span className="font-medium">{dictionary.methods[method].title}</span>
              <span className="text-muted-foreground text-xs">{dictionary.methods[method].hint}</span>
            </button>
          ))}
        </div>
        {is_automatic ? (
          <FormField
            id="discount-title"
            label={dictionary.automatic_title}
            description={dictionary.automatic_title_hint}
            error={issue("title")}
          >
            {(control) => (
              <Input
                {...control}
                value={form.title}
                maxLength={120}
                disabled={is_locked}
                placeholder={dictionary.automatic_title_placeholder}
                onChange={(event) => set({ title: event.target.value })}
              />
            )}
          </FormField>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <FormField
                  id="discount-code"
                  label={dictionary.code}
                  description={dictionary.code_hint}
                  error={issue("code")}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={form.code}
                      disabled={is_locked}
                      maxLength={50}
                      className="font-mono uppercase"
                      placeholder="SUMMER10"
                      onChange={(event) => set({ code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                    />
                  )}
                </FormField>
              </div>
              {!is_locked && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6"
                  onClick={() => set({ code: generateDiscountCode() })}
                >
                  <RefreshCwIcon />
                  {dictionary.generate}
                </Button>
              )}
            </div>
            <FormField
              id="discount-title"
              label={dictionary.internal_title}
              description={dictionary.internal_title_hint}
            >
              {(control) => (
                <Input
                  {...control}
                  value={form.title}
                  maxLength={120}
                  disabled={is_locked}
                  onChange={(event) => set({ title: event.target.value })}
                />
              )}
            </FormField>
          </>
        )}
      </SectionCard>

      <SectionCard title={dictionary.value_title}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="discount-type" label={dictionary.type}>
            {(control) => (
              <NativeSelect
                {...control}
                value={form.type}
                disabled={is_locked}
                className="w-full"
                onChange={(event) => {
                  const type = DISCOUNT_TYPES.find((item) => item === event.target.value) ?? "percent";
                  set({ type, value: DEFAULT_VALUE[type] });
                }}
              >
                {DISCOUNT_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {dictionary.types[type]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {form.type === "percent" && (
            <FormField id="discount-value" label={dictionary.percent} error={issue("value")}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  max={100}
                  value={form.value}
                  disabled={is_locked}
                  onChange={(event) => set({ value: Math.round(Number(event.target.value)) || 0 })}
                />
              )}
            </FormField>
          )}
          {form.type === "fixed" && (
            <FormField id="discount-value" label={dictionary.amount} error={issue("value")}>
              {(control) => (
                <MoneyInput
                  id={control.id}
                  aria-describedby={control["aria-describedby"]}
                  cents={form.value}
                  onChange={(value) => set({ value })}
                  currency={currency}
                  lang={lang}
                  disabled={is_locked}
                />
              )}
            </FormField>
          )}
        </div>
        {(form.type === "percent" || form.type === "fixed") && (
          <TargetPicker
            id="discount-applies"
            label={dictionary.applies_to}
            lang={lang}
            value={form.applies_to}
            names={names}
            all_label={dictionary.applies.all}
            error={issue("applies_to")}
            is_locked={is_locked}
            onChange={(applies_to, picked) => {
              pick(picked);
              set({ applies_to });
            }}
            dictionary={dictionary}
          />
        )}
      </SectionCard>

      {is_deal && (
        <>
          <SectionCard title={dictionary.deal.buys_title}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="deal-buy-kind" label={dictionary.deal.buy_kind}>
                {(control) => (
                  <NativeSelect
                    {...control}
                    value={deal.buy.kind}
                    disabled={is_locked}
                    className="w-full"
                    onChange={(event) => {
                      const kind = event.target.value === "amount" ? "amount" : "quantity";
                      setDeal({ buy: { ...deal.buy, kind, value: kind === "amount" ? 5000 : 2 } });
                    }}
                  >
                    <NativeSelectOption value="quantity">{dictionary.deal.buy_kinds.quantity}</NativeSelectOption>
                    <NativeSelectOption value="amount">{dictionary.deal.buy_kinds.amount}</NativeSelectOption>
                  </NativeSelect>
                )}
              </FormField>
              {deal.buy.kind === "quantity" ? (
                <FormField id="deal-buy-value" label={dictionary.deal.quantity}>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={1}
                      value={deal.buy.value}
                      disabled={is_locked}
                      onChange={(event) =>
                        setDeal({
                          buy: { ...deal.buy, value: Math.max(1, Math.round(Number(event.target.value)) || 1) },
                        })
                      }
                    />
                  )}
                </FormField>
              ) : (
                <FormField id="deal-buy-value" label={dictionary.deal.amount}>
                  {(control) => (
                    <MoneyInput
                      id={control.id}
                      aria-describedby={control["aria-describedby"]}
                      cents={deal.buy.value}
                      onChange={(value) => setDeal({ buy: { ...deal.buy, value: Math.max(value, 1) } })}
                      currency={currency}
                      lang={lang}
                      disabled={is_locked}
                    />
                  )}
                </FormField>
              )}
            </div>
            <TargetPicker
              id="deal-buy-from"
              label={dictionary.deal.from}
              lang={lang}
              value={deal.buy.applies_to}
              names={names}
              all_label={dictionary.deal.any_product}
              error={deal.buy.applies_to.kind !== "all" ? issue("buy_x_get_y") : undefined}
              is_locked={is_locked}
              onChange={(applies_to, picked) => {
                pick(picked);
                setDeal({ buy: { ...deal.buy, applies_to } });
              }}
              dictionary={dictionary}
            />
          </SectionCard>

          <SectionCard title={dictionary.deal.gets_title} description={dictionary.deal.gets_hint}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="deal-get-quantity" label={dictionary.deal.quantity}>
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={1}
                    max={100}
                    value={deal.get.quantity}
                    disabled={is_locked}
                    onChange={(event) =>
                      setDeal({
                        get: {
                          ...deal.get,
                          quantity: Math.min(100, Math.max(1, Math.round(Number(event.target.value)) || 1)),
                        },
                      })
                    }
                  />
                )}
              </FormField>
              <FormField
                id="deal-get-percent"
                label={dictionary.deal.percent}
                description={dictionary.deal.percent_hint}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={1}
                    max={100}
                    value={deal.get.percent}
                    disabled={is_locked}
                    onChange={(event) =>
                      setDeal({
                        get: {
                          ...deal.get,
                          percent: Math.min(100, Math.max(1, Math.round(Number(event.target.value)) || 1)),
                        },
                      })
                    }
                  />
                )}
              </FormField>
            </div>
            <TargetPicker
              id="deal-get-from"
              label={dictionary.deal.from}
              lang={lang}
              value={deal.get.applies_to}
              names={names}
              all_label={dictionary.deal.any_product}
              error={deal.get.applies_to.kind !== "all" ? issue("buy_x_get_y") : undefined}
              is_locked={is_locked}
              onChange={(applies_to, picked) => {
                pick(picked);
                setDeal({ get: { ...deal.get, applies_to } });
              }}
              dictionary={dictionary}
            />
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={deal.max_uses > 0}
                disabled={is_locked}
                aria-label={dictionary.deal.max_uses}
                onCheckedChange={(is_on) => setDeal({ max_uses: is_on ? 1 : 0 })}
              />
              {dictionary.deal.max_uses}
            </label>
            {deal.max_uses > 0 && (
              <Input
                type="number"
                min={1}
                max={100}
                aria-label={dictionary.deal.max_uses}
                value={deal.max_uses}
                disabled={is_locked}
                className="max-w-48"
                onChange={(event) =>
                  setDeal({ max_uses: Math.min(100, Math.max(1, Math.round(Number(event.target.value)) || 1)) })
                }
              />
            )}
          </SectionCard>
        </>
      )}

      <SectionCard title={dictionary.requirements_title}>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={form.min_subtotal > 0}
            disabled={is_locked}
            aria-label={dictionary.minimum}
            onCheckedChange={(is_on) => set({ min_subtotal: is_on ? 5000 : 0 })}
          />
          {dictionary.minimum}
        </label>
        {form.min_subtotal > 0 && (
          <MoneyInput
            id="discount-minimum"
            aria-label={dictionary.minimum}
            cents={form.min_subtotal}
            onChange={(min_subtotal) => set({ min_subtotal })}
            currency={currency}
            lang={lang}
            disabled={is_locked}
            className="max-w-48"
          />
        )}
        {is_automatic ? (
          <p className="text-muted-foreground text-xs">{dictionary.automatic_no_limits}</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={form.usage_limit > 0}
                disabled={is_locked}
                aria-label={dictionary.usage_limit}
                onCheckedChange={(is_on) => set({ usage_limit: is_on ? 100 : 0 })}
              />
              {dictionary.usage_limit}
            </label>
            {form.usage_limit > 0 && (
              <Input
                type="number"
                min={1}
                aria-label={dictionary.usage_limit}
                value={form.usage_limit}
                disabled={is_locked}
                className="max-w-48"
                onChange={(event) => set({ usage_limit: Math.max(1, Math.round(Number(event.target.value)) || 1) })}
              />
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={form.once_per_customer}
                disabled={is_locked}
                aria-label={dictionary.once_per_customer}
                onCheckedChange={(once_per_customer) => set({ once_per_customer })}
              />
              {dictionary.once_per_customer}
            </label>
          </>
        )}
      </SectionCard>

      <SectionCard
        title={dictionary.combine.title}
        description={dictionary.combine.hint.replace("{class}", dictionary.combine.own[own_class])}
      >
        <div className="flex flex-col gap-2">
          {DISCOUNT_CLASSES.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.combines_with[item]}
                disabled={is_locked}
                onCheckedChange={(checked) =>
                  set({ combines_with: { ...form.combines_with, [item]: checked === true } })
                }
              />
              {dictionary.combine.classes[item]}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={dictionary.dates_title} description={dictionary.dates_hint.replace("{zone}", time_zone)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="discount-starts" label={dictionary.starts_at} description={dictionary.starts_at_hint}>
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={form.starts_at}
                disabled={is_locked}
                onChange={(event) => set({ starts_at: event.target.value })}
              />
            )}
          </FormField>
          <FormField
            id="discount-ends"
            label={dictionary.ends_at}
            description={dictionary.ends_at_hint}
            error={issue("ends_at")}
          >
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={form.ends_at}
                disabled={is_locked}
                onChange={(event) => set({ ends_at: event.target.value })}
              />
            )}
          </FormField>
        </div>
      </SectionCard>
    </>
  );

  const heading = is_automatic ? form.title || dictionary.methods.automatic.title : form.code;
  const sidebar = (
    <>
      <SectionCard title={dictionary.summary_title}>
        <p className={cn("text-sm font-semibold", !is_automatic && "font-mono")}>{heading || "—"}</p>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-sm">
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {view && <p className="text-sm">{dictionary.used.replace("{count}", String(view.discount.used_count))}</p>}
        {view && (
          <p className="text-muted-foreground text-xs">
            {dictionary.created.replace("{date}", formatDateTime(view.discount.created_at, lang))}
          </p>
        )}
      </SectionCard>
      <SectionCard title={dictionary.status_title}>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={form.is_active}
            disabled={is_locked}
            aria-label={dictionary.is_active}
            onCheckedChange={(is_active) => set({ is_active })}
          />
          {dictionary.is_active}
        </label>
      </SectionCard>
      {view && can_edit && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive self-start"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2Icon />
          {dictionary.delete}
        </Button>
      )}
    </>
  );

  return (
    <Page
      title={
        is_new ? dictionary.new_title : view.discount.method === "automatic" ? view.discount.title : view.discount.code
      }
      title_meta={
        status ? <StatusBadge tone={DISCOUNT_TONE[status]}>{dictionary.status[status]}</StatusBadge> : undefined
      }
      back={{ href: "/discounts", label: dictionary.title }}
    >
      <DetailLayout main={main} sidebar={sidebar} />
      {view && (
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
            remove.mutate(view.discount.id, {
              onSuccess: () => router.push("/discounts"),
              onError: (error) => toast.error(errorText(errors, error)),
            })
          }
        />
      )}
      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={create.isPending || update.isPending}
          can_save={parsed.success}
          onDiscard={() => (is_new ? router.push("/discounts") : setForm(initial))}
          onSave={onSave}
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}
