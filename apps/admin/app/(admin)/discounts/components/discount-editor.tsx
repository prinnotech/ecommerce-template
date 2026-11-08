"use client";

import { RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DISCOUNT_TONE, discountValueText } from "./discounts-table";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { DiscountView } from "@repo/core/actions/discounts";
import type { DiscountTarget } from "@repo/core/backend/types";
import { FormField } from "@repo/core/components/form-field";
import { useAdminCategories, useAdminProducts } from "@repo/core/hooks/use-catalog";
import { useCreateDiscount, useDeleteDiscount, useUpdateDiscount } from "@repo/core/hooks/use-discounts";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { product_list_filters_schema } from "@repo/core/lib/schemas/catalog";
import {
  APPLIES_TO_ALL,
  DISCOUNT_TYPES,
  discount_input_schema,
  discountStatus,
  generateDiscountCode,
  type DiscountAppliesTo,
  type DiscountType,
} from "@repo/core/lib/schemas/discounts";
import { formatCurrency, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";
import { fromZonedInput, toZonedInput } from "@repo/core/lib/utils/zoned-input";
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
};

function initialForm(view: DiscountView | null, time_zone: string): DiscountForm {
  const discount = view?.discount;
  return {
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
  };
}

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
  const [targets, setTargets] = useState<DiscountTarget[]>(view?.targets ?? []);
  const [product_search, setProductSearch] = useState("");
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  // An empty code on a new discount isn't an error until the first save.
  const [is_submitted, setIsSubmitted] = useState(false);
  const products = useAdminProducts(product_list_filters_schema.parse({ search: product_search }));
  const categories = useAdminCategories();
  const locale = lang as Locale;
  const set = (patch: Partial<DiscountForm>) => setForm((current) => ({ ...current, ...patch }));
  const is_locked = !can_edit;
  const is_new = view === null;

  const input = {
    ...form,
    starts_at: fromZonedInput(form.starts_at, time_zone),
    ends_at: fromZonedInput(form.ends_at, time_zone),
    value: form.type === "free_shipping" ? 0 : form.value,
  };
  const parsed = discount_input_schema.safeParse(input);
  const is_dirty = is_new || JSON.stringify(form) !== JSON.stringify(initial);
  const issue = (path: string) =>
    parsed.success || (path === "code" && !form.code && !is_submitted)
      ? undefined
      : parsed.error.issues.find((item) => item.path[0] === path)
        ? dictionary.invalid[path as keyof typeof dictionary.invalid]
        : undefined;

  function setAppliesKind(kind: DiscountAppliesTo["kind"]) {
    setTargets([]);
    set({ applies_to: { kind, ids: [] } });
  }

  function toggleTarget(target: DiscountTarget, is_on: boolean) {
    const ids = is_on
      ? [...new Set([...form.applies_to.ids, target.id])]
      : form.applies_to.ids.filter((id) => id !== target.id);
    setTargets((current) =>
      is_on
        ? [...current.filter((item) => item.id !== target.id), target]
        : current.filter((item) => item.id !== target.id),
    );
    set({ applies_to: { ...form.applies_to, ids } });
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
  const summary = [
    discountValueText({ type: form.type, value: form.value }, currency, lang, dictionary),
    form.applies_to.kind === "all"
      ? dictionary.summary.whole_order
      : formatPlural(form.applies_to.ids.length, dictionary.summary[form.applies_to.kind], lang),
    form.min_subtotal > 0
      ? dictionary.summary.minimum.replace("{amount}", formatCurrency(form.min_subtotal, currency, lang))
      : dictionary.summary.no_minimum,
    form.usage_limit > 0
      ? dictionary.summary.limit.replace("{count}", String(form.usage_limit))
      : dictionary.summary.no_limit,
    ...(form.once_per_customer ? [dictionary.summary.once_per_customer] : []),
  ];

  const main = (
    <>
      <SectionCard title={dictionary.code_title} description={dictionary.code_hint}>
        <div className="flex gap-2">
          <div className="flex-1">
            <FormField id="discount-code" label={dictionary.code} error={issue("code")}>
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
        <FormField id="discount-title" label={dictionary.internal_title} description={dictionary.internal_title_hint}>
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
                  set({ type, value: type === "percent" ? 10 : type === "fixed" ? 500 : 0 });
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
        {form.type !== "free_shipping" && (
          <div className="flex flex-col gap-3">
            <FormField id="discount-applies" label={dictionary.applies_to} error={issue("applies_to")}>
              {(control) => (
                <NativeSelect
                  {...control}
                  value={form.applies_to.kind}
                  disabled={is_locked}
                  className="w-full"
                  onChange={(event) =>
                    setAppliesKind(
                      event.target.value === "products"
                        ? "products"
                        : event.target.value === "categories"
                          ? "categories"
                          : "all",
                    )
                  }
                >
                  <NativeSelectOption value="all">{dictionary.applies.all}</NativeSelectOption>
                  <NativeSelectOption value="products">{dictionary.applies.products}</NativeSelectOption>
                  <NativeSelectOption value="categories">{dictionary.applies.categories}</NativeSelectOption>
                </NativeSelect>
              )}
            </FormField>

            {form.applies_to.kind === "products" && (
              <div className="flex flex-col gap-2">
                {targets.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {targets.map((target) => (
                      <li key={target.id} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                        {localized(target.name, locale)}
                        {!is_locked && (
                          <button
                            type="button"
                            aria-label={dictionary.remove_target.replace("{name}", localized(target.name, locale))}
                            onClick={() => toggleTarget(target, false)}
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!is_locked && (
                  <>
                    <Input
                      type="search"
                      value={product_search}
                      placeholder={dictionary.search_products}
                      aria-label={dictionary.search_products}
                      onChange={(event) => setProductSearch(event.target.value)}
                    />
                    <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                      {(products.data?.items ?? []).map((product) => {
                        const target = { id: product.id, name: product.title };
                        const is_on = form.applies_to.ids.includes(product.id);
                        return (
                          <li key={product.id}>
                            <label className="hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                              <Checkbox
                                checked={is_on}
                                onCheckedChange={(checked) => toggleTarget(target, checked === true)}
                              />
                              {localized(product.title, locale)}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}

            {form.applies_to.kind === "categories" && (
              <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                {(categories.data ?? []).map((category) => {
                  const target = { id: category.id, name: category.name };
                  return (
                    <li key={category.id}>
                      <label className="hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                        <Checkbox
                          checked={form.applies_to.ids.includes(category.id)}
                          disabled={is_locked}
                          onCheckedChange={(checked) => toggleTarget(target, checked === true)}
                        />
                        {localized(category.name, locale)}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </SectionCard>

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

  const sidebar = (
    <>
      <SectionCard title={dictionary.summary_title}>
        <p className="font-mono text-sm font-semibold">{form.code || "—"}</p>
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
      title={is_new ? dictionary.new_title : view.discount.code}
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
