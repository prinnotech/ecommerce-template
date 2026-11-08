"use client";

import { CheckIcon, CopyIcon, PlusIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CustomerPicker, CustomItemDialog, ProductPicker, variantText } from "./draft-pickers";
import { DRAFT_TONE } from "../../components/drafts-table";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { DraftOrderView } from "@repo/core/actions/draft-orders";
import type { DraftOrder } from "@repo/core/backend/types";
import { FormField } from "@repo/core/components/form-field";
import {
  useCompleteDraftOrder,
  useDeleteDraftOrder,
  useDraftOrder,
  useSaveDraftOrder,
  useSendDraftInvoice,
} from "@repo/core/hooks/use-draft-orders";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { COUNTRY_CODES } from "@repo/core/lib/locale/countries";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import type { AddressFields } from "@repo/core/lib/schemas/account";
import { draft_fields_schema, MAX_DRAFT_LINES, type DraftFieldsInput } from "@repo/core/lib/schemas/draft-orders";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";

type DraftEditorProps = {
  lang: string;
  draft_id: string;
  can_edit: boolean;
  countries: { value: string; label: string }[];
  // New addresses start in the store's country.
  // "" when the store's address has no country yet: staff pick one.
  store_country: AddressFields["country"] | "";
  dictionary: AdminDictionary["draft_orders"];
  checkout: AdminDictionary["checkout"];
  common: AdminDictionary["common"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  validation: AdminDictionary["validation"];
  errors: AdminDictionary["errors"];
};

// How a line looks on screen: from the saved, priced draft, or from the picker result.
type LineLabel = { title: string; detail: string; image: string; unit_price: number | null };

// The form's address may have no country yet ("" until one is picked); validation catches it.
type AddressDraft = Omit<AddressFields, "country"> & { country: AddressFields["country"] | "" };
type DraftForm = Omit<DraftFieldsInput, "shipping_address"> & { shipping_address: AddressDraft | null };

function emptyAddress(country: AddressDraft["country"]): AddressDraft {
  return { full_name: "", phone: "", line1: "", line2: "", city: "", region: "", postal_code: "", country };
}

function toInput(draft: DraftOrder): DraftFieldsInput {
  return {
    user_id: draft.user_id,
    email: draft.email,
    customer_name: draft.customer_name,
    phone: draft.phone,
    locale: LOCALES.find((locale) => locale === draft.locale) ?? LOCALES[0],
    lines: draft.lines.map((line) =>
      line.variant_id
        ? { variant_id: line.variant_id, quantity: line.quantity }
        : { variant_id: "", title: line.title, unit_price: line.unit_price, quantity: line.quantity },
    ),
    shipping_address: draft.shipping_address,
    shipping_method: draft.shipping_method,
    shipping_price: draft.shipping_price,
    discount: draft.discount,
    note: draft.note,
  };
}

export function DraftEditor(props: DraftEditorProps) {
  const view = useDraftOrder(props.draft_id);
  if (view.isPending) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (view.isError) return <p className="text-destructive text-sm">{errorText(props.errors, view.error)}</p>;
  // Remount on each save, so the form starts from what the server stored.
  return <DraftForm key={view.data.draft.updated_at} {...props} view={view.data} />;
}

function DraftForm({
  lang,
  draft_id,
  can_edit,
  countries,
  store_country,
  dictionary,
  checkout,
  common,
  confirm,
  save_bar,
  validation,
  errors,
  view,
}: DraftEditorProps & { view: DraftOrderView }) {
  const router = useRouter();
  const save = useSaveDraftOrder(draft_id);
  const invoice = useSendDraftInvoice(draft_id);
  const complete = useCompleteDraftOrder(draft_id);
  const remove = useDeleteDraftOrder();
  const { draft, priced } = view;
  const initial = toInput(draft);
  const [form, setForm] = useState<DraftForm>(initial);
  const [labels, setLabels] = useState<Record<string, LineLabel>>(() =>
    Object.fromEntries(
      priced.lines
        .filter((line) => line.variant_id)
        .map((line) => [
          line.variant_id,
          {
            title: line.title,
            detail: [line.variant_label, line.sku].filter(Boolean).join(" · "),
            image: line.image,
            unit_price: line.unit_price,
          },
        ]),
    ),
  );
  const [is_custom_open, setIsCustomOpen] = useState(false);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const [is_copied, setIsCopied] = useState(false);

  const is_completed = draft.status === "completed";
  const is_locked = !can_edit || is_completed;
  const is_dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const parsed = draft_fields_schema.safeParse(form);
  const money = (cents: number) => formatCurrency(cents, view.currency, lang);
  const set = (patch: Partial<DraftForm>) => setForm((current) => ({ ...current, ...patch }));
  const address = form.shipping_address ?? emptyAddress(store_country);
  const setAddress = (patch: Partial<AddressDraft>) => set({ shipping_address: { ...address, ...patch } });
  const is_busy = save.isPending || invoice.isPending || complete.isPending || remove.isPending;
  const unavailable = new Set([...priced.removed, ...priced.adjusted]);

  function setLine(index: number, quantity: number) {
    set({ lines: form.lines.map((line, position) => (position === index ? { ...line, quantity } : line)) });
  }

  function onSave() {
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    save.mutate(parsed.data, {
      onSuccess: () => toast.success(dictionary.saved),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  function completeAs(is_paid: boolean) {
    complete.mutate(is_paid, {
      onSuccess: ({ order_id }) => {
        toast.success(dictionary.completed);
        if (order_id) router.push(`/orders/${order_id}`);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  const title = `D${draft.draft_number}`;

  const actions =
    !can_edit || is_completed ? null : (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={is_dirty || is_busy || !view.is_smtp_configured}
          title={view.is_smtp_configured ? undefined : dictionary.smtp_missing}
          onClick={() =>
            invoice.mutate(undefined, {
              onSuccess: () => toast.success(dictionary.invoice_sent.replace("{email}", draft.email)),
              onError: (error) => toast.error(errorText(errors, error)),
            })
          }
        >
          {invoice.isPending ? <Spinner /> : <SendIcon />}
          {draft.status === "invoice_sent" ? dictionary.resend_invoice : dictionary.send_invoice}
        </Button>
        <Button type="button" variant="outline" disabled={is_dirty || is_busy} onClick={() => completeAs(false)}>
          {dictionary.payment_pending}
        </Button>
        <Button type="button" disabled={is_dirty || is_busy} onClick={() => completeAs(true)}>
          {complete.isPending ? <Spinner /> : <CheckIcon />}
          {dictionary.mark_paid}
        </Button>
      </>
    );

  const main = (
    <>
      <SectionCard title={dictionary.products} is_flush>
        <div className="flex flex-col gap-2 px-5 pb-4 xl:flex-row">
          <div className="flex-1">
            <ProductPicker
              lang={lang}
              disabled={is_locked || form.lines.length >= MAX_DRAFT_LINES}
              dictionary={dictionary}
              onPick={(row) => {
                setLabels((current) => ({
                  ...current,
                  [row.variant_id]: current[row.variant_id] ?? {
                    title: localized(row.product_title, lang as Locale),
                    detail: variantText(row),
                    image: row.image_url,
                    unit_price: null,
                  },
                }));
                const index = form.lines.findIndex((line) => line.variant_id === row.variant_id);
                if (index >= 0) setLine(index, Math.min((form.lines[index]?.quantity ?? 0) + 1, 999));
                else set({ lines: [...form.lines, { variant_id: row.variant_id, quantity: 1 }] });
              }}
            />
          </div>
          <Button type="button" variant="outline" disabled={is_locked} onClick={() => setIsCustomOpen(true)}>
            <PlusIcon />
            {dictionary.custom_item}
          </Button>
        </div>
        {form.lines.length === 0 ? (
          <p className="text-muted-foreground border-t px-5 py-6 text-sm">{dictionary.no_lines}</p>
        ) : (
          <ul className="divide-y border-t">
            {form.lines.map((line, index) => {
              const label: LineLabel =
                "title" in line
                  ? { title: line.title, detail: dictionary.custom_line, image: "", unit_price: line.unit_price }
                  : (labels[line.variant_id] ?? { title: "…", detail: "", image: "", unit_price: null });
              return (
                <li key={`${line.variant_id}:${index}`} className="flex items-center gap-3 px-5 py-3">
                  <Thumbnail src={label.image} alt="" size="md" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{label.title}</span>
                    {label.detail && <span className="text-muted-foreground truncate text-xs">{label.detail}</span>}
                    {line.variant_id && unavailable.has(line.variant_id) && (
                      <span className="text-destructive text-xs">{dictionary.not_available}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground hidden text-sm tabular-nums sm:inline">
                    {label.unit_price === null ? "—" : money(label.unit_price)}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={line.quantity}
                    disabled={is_locked}
                    aria-label={dictionary.quantity_for.replace("{name}", label.title)}
                    className="h-8 w-20 text-right tabular-nums"
                    onChange={(event) =>
                      setLine(index, Math.max(1, Math.min(999, Math.round(Number(event.target.value)) || 1)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={is_locked}
                    aria-label={dictionary.remove_line.replace("{name}", label.title)}
                    onClick={() => set({ lines: form.lines.filter((_line, position) => position !== index) })}
                  >
                    <XIcon />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={dictionary.shipping_and_discount}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="draft-shipping-method" label={checkout.shipping_method}>
            {(control) => (
              <NativeSelect
                {...control}
                value={form.shipping_method}
                disabled={is_locked}
                className="w-full"
                onChange={(event) => set({ shipping_method: event.target.value })}
              >
                {view.shipping_rates.map((rate) => (
                  <NativeSelectOption key={rate.id} value={rate.id}>
                    {`${rate.name} · ${money(rate.price)}`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={form.shipping_price !== null}
                aria-label={dictionary.own_shipping_price}
                disabled={is_locked}
                onCheckedChange={(is_on) => set({ shipping_price: is_on ? 0 : null })}
              />
              {dictionary.own_shipping_price}
            </label>
            {form.shipping_price !== null && (
              <MoneyInput
                id="draft-shipping-price"
                aria-label={dictionary.own_shipping_price}
                cents={form.shipping_price ?? 0}
                onChange={(cents) => set({ shipping_price: cents })}
                currency={view.currency}
                lang={lang}
                disabled={is_locked}
              />
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="draft-discount-type" label={dictionary.discount}>
            {(control) => (
              <NativeSelect
                {...control}
                value={form.discount?.type ?? ""}
                disabled={is_locked}
                className="w-full"
                onChange={(event) => {
                  const type = event.target.value;
                  set({
                    discount:
                      type === "percent" || type === "fixed"
                        ? {
                            type,
                            value: form.discount?.value ?? (type === "percent" ? 10 : 100),
                            reason: form.discount?.reason ?? "",
                          }
                        : null,
                  });
                }}
              >
                <NativeSelectOption value="">{dictionary.no_discount}</NativeSelectOption>
                <NativeSelectOption value="percent">{dictionary.discount_percent}</NativeSelectOption>
                <NativeSelectOption value="fixed">{dictionary.discount_fixed}</NativeSelectOption>
              </NativeSelect>
            )}
          </FormField>
          {form.discount && (
            <>
              <FormField id="draft-discount-value" label={dictionary.discount_value}>
                {(control) =>
                  form.discount?.type === "fixed" ? (
                    <MoneyInput
                      id={control.id}
                      aria-describedby={control["aria-describedby"]}
                      cents={form.discount.value}
                      onChange={(value) => form.discount && set({ discount: { ...form.discount, value } })}
                      currency={view.currency}
                      lang={lang}
                      disabled={is_locked}
                    />
                  ) : (
                    <Input
                      {...control}
                      type="number"
                      min={1}
                      max={100}
                      value={form.discount?.value ?? 0}
                      disabled={is_locked}
                      onChange={(event) =>
                        form.discount &&
                        set({ discount: { ...form.discount, value: Math.round(Number(event.target.value)) || 0 } })
                      }
                    />
                  )
                }
              </FormField>
              <FormField id="draft-discount-reason" label={dictionary.discount_reason} optional_label={common.optional}>
                {(control) => (
                  <Input
                    {...control}
                    value={form.discount?.reason ?? ""}
                    maxLength={200}
                    disabled={is_locked}
                    onChange={(event) =>
                      form.discount && set({ discount: { ...form.discount, reason: event.target.value } })
                    }
                  />
                )}
              </FormField>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title={dictionary.payment} description={is_dirty ? dictionary.totals_after_save : undefined}>
        <dl className="flex flex-col gap-2 text-sm">
          <TotalRow label={checkout.subtotal} value={money(priced.totals.subtotal)} />
          {priced.totals.discount_total > 0 && (
            <TotalRow label={checkout.discount} value={`−${money(priced.totals.discount_total)}`} />
          )}
          <TotalRow
            label={checkout.shipping}
            value={priced.totals.shipping_total === 0 ? checkout.free : money(priced.totals.shipping_total)}
          />
          {priced.totals.tax_total > 0 && <TotalRow label={checkout.taxes} value={money(priced.totals.tax_total)} />}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>{checkout.total}</dt>
            <dd className="tabular-nums">{money(priced.totals.total)}</dd>
          </div>
        </dl>
        {view.invoice_url && (
          <div className="flex items-center gap-2">
            <Input readOnly value={view.invoice_url} aria-label={dictionary.invoice_link} className="text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={dictionary.copy_link}
              onClick={() => {
                void navigator.clipboard.writeText(view.invoice_url).then(() => setIsCopied(true));
              }}
            >
              {is_copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        )}
      </SectionCard>
    </>
  );

  const sidebar = (
    <>
      <SectionCard title={dictionary.customer}>
        {!is_locked && (
          <CustomerPicker
            disabled={is_locked}
            dictionary={dictionary}
            onPick={(customer) =>
              set({
                user_id: customer.id,
                email: customer.email,
                customer_name: customer.name || form.customer_name,
                phone: customer.phone || form.phone,
              })
            }
          />
        )}
        {form.user_id && (
          <p className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
            {dictionary.linked_account}
            {!is_locked && (
              <button type="button" className="underline underline-offset-4" onClick={() => set({ user_id: "" })}>
                {dictionary.unlink}
              </button>
            )}
          </p>
        )}
        <FormField id="draft-name" label={dictionary.customer_name}>
          {(control) => (
            <Input
              {...control}
              value={form.customer_name}
              maxLength={200}
              disabled={is_locked}
              onChange={(event) => set({ customer_name: event.target.value })}
            />
          )}
        </FormField>
        <FormField id="draft-email" label={checkout.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              value={form.email}
              disabled={is_locked}
              onChange={(event) => set({ email: event.target.value.trim() })}
            />
          )}
        </FormField>
        <FormField id="draft-phone" label={checkout.phone} optional_label={common.optional}>
          {(control) => (
            <Input
              {...control}
              type="tel"
              value={form.phone}
              maxLength={50}
              disabled={is_locked}
              onChange={(event) => set({ phone: event.target.value })}
            />
          )}
        </FormField>
        <FormField id="draft-locale" label={dictionary.language} description={dictionary.language_hint}>
          {(control) => (
            <NativeSelect
              {...control}
              value={form.locale}
              disabled={is_locked}
              className="w-full uppercase"
              onChange={(event) =>
                set({ locale: LOCALES.find((locale) => locale === event.target.value) ?? LOCALES[0] })
              }
            >
              {LOCALES.map((locale) => (
                <NativeSelectOption key={locale} value={locale}>
                  {locale}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </SectionCard>

      <SectionCard
        title={dictionary.shipping_address}
        action={
          !is_locked && form.shipping_address ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => set({ shipping_address: null })}>
              {dictionary.clear}
            </Button>
          ) : undefined
        }
      >
        {!form.shipping_address && !is_locked ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              set({
                shipping_address: { ...emptyAddress(store_country), full_name: form.customer_name, phone: form.phone },
              })
            }
          >
            <PlusIcon />
            {dictionary.add_address}
          </Button>
        ) : form.shipping_address ? (
          <div className="flex flex-col gap-3">
            <FormField
              id="draft-address-country"
              label={checkout.country}
              error={address.country ? undefined : validation.invalid_country}
            >
              {(control) => (
                <NativeSelect
                  {...control}
                  value={address.country}
                  disabled={is_locked}
                  className="w-full"
                  onChange={(event) => {
                    const country = COUNTRY_CODES.find((code) => code === event.target.value);
                    if (country) setAddress({ country });
                  }}
                >
                  {!address.country && (
                    <NativeSelectOption value="" disabled>
                      —
                    </NativeSelectOption>
                  )}
                  {countries.map((country) => (
                    <NativeSelectOption key={country.value} value={country.value}>
                      {country.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {(["full_name", "line1", "line2", "postal_code", "city", "region", "phone"] as const).map((field) => (
              <FormField key={field} id={`draft-address-${field}`} label={checkout[field]}>
                {(control) => (
                  <Input
                    {...control}
                    value={address[field]}
                    disabled={is_locked}
                    onChange={(event) => setAddress({ [field]: event.target.value })}
                  />
                )}
              </FormField>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">—</p>
        )}
      </SectionCard>

      <SectionCard title={dictionary.note}>
        <Textarea
          rows={3}
          maxLength={2000}
          value={form.note}
          disabled={is_locked}
          aria-label={dictionary.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </SectionCard>

      {can_edit && !is_completed && (
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
      title={title}
      title_meta={<StatusBadge tone={DRAFT_TONE[draft.status]}>{dictionary.status[draft.status]}</StatusBadge>}
      back={{ href: "/orders/drafts", label: dictionary.title }}
      secondary_actions={actions}
    >
      {is_completed && view.order_number !== null && (
        <p className="bg-muted rounded-md px-4 py-3 text-sm">
          {dictionary.completed_note}{" "}
          <Link href={`/orders/${draft.order_id}`} className="font-medium underline underline-offset-4">
            {`#${view.order_number}`}
          </Link>
        </p>
      )}
      {is_dirty && !is_completed && <p className="text-muted-foreground text-sm">{dictionary.save_first}</p>}
      <DetailLayout main={main} sidebar={sidebar} />

      <CustomItemDialog
        is_open={is_custom_open}
        onOpenChange={setIsCustomOpen}
        onAdd={(line) => set({ lines: [...form.lines, { variant_id: "", ...line }] })}
        currency={view.currency}
        lang={lang}
        dictionary={dictionary}
        common={common}
      />
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
          remove.mutate(draft_id, {
            onSuccess: () => router.push("/orders/drafts"),
            onError: (error) => toast.error(errorText(errors, error)),
          })
        }
      />
      {can_edit && !is_completed && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={save.isPending}
          can_save={parsed.success}
          onDiscard={() => setForm(initial)}
          onSave={onSave}
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
