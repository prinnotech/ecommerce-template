"use client";

import { ChevronDownIcon, CircleAlertIcon, CreditCardIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { AddressFieldset, EMPTY_ADDRESS, type AddressDraft } from "./address-fieldset";
import { FloatingInput, FloatingSelect } from "./floating-field";
import { OrderSummary } from "./order-summary";
import type { CheckoutView } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCompleteCheckout, useQuoteCheckout } from "@/hooks/use-cart";
import { ActionError, errorText } from "@/lib/action-result";
import type { Totals } from "@/lib/checkout/pricing";
import type { Dictionary } from "@/lib/i18n";
import { complete_checkout_schema, isValidCardNumber, isValidExpiry, type PaymentMethod } from "@/lib/schemas/checkout";
import { fieldErrors } from "@/lib/schemas/validation";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

type CheckoutFormProps = {
  lang: string;
  checkout: CheckoutView;
  countries: { value: string; label: string }[];
  dictionary: Dictionary["checkout"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
  loading_label: string;
};

type Card = { number: string; expiry: string; cvc: string; name: string };

function toDraft(address: CheckoutView["saved_addresses"][number] | undefined): AddressDraft {
  if (!address) return EMPTY_ADDRESS;
  const { id: _id, is_default: _is_default, ...fields } = address;
  return { ...EMPTY_ADDRESS, ...fields };
}

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export function CheckoutForm({
  lang,
  checkout,
  countries,
  dictionary,
  errors,
  validation,
  loading_label,
}: CheckoutFormProps) {
  const router = useRouter();
  const quote = useQuoteCheckout();
  const complete = useCompleteCheckout();

  const default_address = checkout.saved_addresses.find((address) => address.is_default) ?? checkout.saved_addresses[0];
  const [email, setEmail] = useState(checkout.email);
  const [saved_address_id, setSavedAddressId] = useState(default_address?.id ?? "");
  const [shipping_address, setShippingAddress] = useState<AddressDraft>(() => toDraft(default_address));
  const [is_billing_same, setIsBillingSame] = useState(true);
  const [billing_address, setBillingAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [shipping_method, setShippingMethod] = useState(
    checkout.shipping_method || checkout.shipping_rates[0]?.id || "",
  );
  const [payment_method, setPaymentMethod] = useState<PaymentMethod>(checkout.payment_method);
  const [card, setCard] = useState<Card>({ number: "", expiry: "", cvc: "", name: "" });
  const [note, setNote] = useState("");
  const [totals, setTotals] = useState<Totals>(checkout.totals);
  const [applied_code, setAppliedCode] = useState(checkout.discount_code);
  const [is_discount_invalid, setIsDiscountInvalid] = useState(false);
  const [field_errors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [payment_error, setPaymentError] = useState("");
  const [is_summary_open, setIsSummaryOpen] = useState(false);

  const money = (cents: number) => formatCurrency(cents, checkout.currency, lang);
  const is_cod = payment_method === "cash_on_delivery";

  function requote(patch: { shipping_method?: string; payment_method?: PaymentMethod; discount_code?: string }) {
    const next = { shipping_method, payment_method, discount_code: applied_code, ...patch };
    quote.mutate(
      { session_id: checkout.id, ...next },
      {
        onSuccess: (result) => {
          setTotals(result.totals);
          setAppliedCode(result.discount_code);
          setIsDiscountInvalid(result.is_discount_invalid);
        },
        onError: (error) => {
          if (error instanceof ActionError && error.code === "checkout_expired") router.refresh();
          else toast.error(errorText(errors, error));
        },
      },
    );
  }

  function onSavedAddress(id: string) {
    setSavedAddressId(id);
    setShippingAddress(toDraft(checkout.saved_addresses.find((address) => address.id === id)));
  }

  function validateCard(): Record<string, string> {
    const card_errors: Record<string, string> = {};
    if (!isValidCardNumber(card.number)) card_errors["card.number"] = dictionary.card_errors.number;
    if (!isValidExpiry(card.expiry)) card_errors["card.expiry"] = dictionary.card_errors.expiry;
    if (!/^\d{3,4}$/.test(card.cvc)) card_errors["card.cvc"] = dictionary.card_errors.cvc;
    if (!card.name.trim()) card_errors["card.name"] = dictionary.card_errors.name;
    return card_errors;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError("");

    const parsed = complete_checkout_schema.safeParse({
      session_id: checkout.id,
      email,
      shipping_address,
      is_billing_same,
      billing_address: is_billing_same ? null : billing_address,
      shipping_method,
      payment_method,
      discount_code: applied_code,
      customer_note: note,
      expected_total: totals.total,
    });
    const schema_errors = parsed.success ? {} : fieldErrors(parsed.error);
    const next_errors: Record<string, string | undefined> = Object.fromEntries(
      Object.entries(schema_errors).map(([field, key]) => [field, key ? validation[key] : undefined]),
    );
    // Card fields are checked here only: they are never sent to the server.
    if (payment_method === "card") Object.assign(next_errors, validateCard());
    setFieldErrors(next_errors);
    if (!parsed.success || Object.keys(next_errors).length > 0) {
      toast.error(dictionary.fix_errors);
      return;
    }

    complete.mutate(parsed.data, {
      onSuccess: () => router.replace(`/${lang}/checkout/${checkout.id}/thank-you`),
      onError: (error) => {
        const code = error instanceof ActionError ? error.code : "generic";
        if (code === "card_declined") {
          setPaymentError(errors.card_declined);
          document.getElementById("payment")?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (code === "checkout_updated" || code === "out_of_stock" || code === "checkout_expired") {
          toast.error(errors[code]);
          // The server already updated the session: reload its lines and recompute the totals shown.
          router.refresh();
          if (code !== "checkout_expired") requote({});
        } else {
          toast.error(errorText(errors, error));
        }
      },
    });
  }

  const summary = (id_prefix: string) => (
    <OrderSummary
      id_prefix={id_prefix}
      lines={checkout.lines}
      totals={totals}
      currency={checkout.currency}
      lang={lang}
      tax_included={checkout.tax_included}
      applied_code={applied_code}
      is_discount_invalid={is_discount_invalid}
      is_quoting={quote.isPending}
      onApplyDiscount={(code) => requote({ discount_code: code })}
      dictionary={dictionary}
      invalid_discount_label={errors.invalid_discount}
      loading_label={loading_label}
    />
  );

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Mobile: collapsible summary bar, like Shopify. */}
      <div className="bg-muted/40 border-b lg:hidden">
        <button
          type="button"
          aria-expanded={is_summary_open}
          aria-controls="mobile-summary"
          onClick={() => setIsSummaryOpen((open) => !open)}
          className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-4 text-sm"
        >
          <span className="flex items-center gap-1.5 font-medium">
            {is_summary_open ? dictionary.hide_summary : dictionary.show_summary}
            <ChevronDownIcon className={cn("size-4 transition-transform", is_summary_open && "rotate-180")} />
          </span>
          <span className="text-base font-semibold tabular-nums">{money(totals.total)}</span>
        </button>
        {is_summary_open && (
          <div id="mobile-summary" className="mx-auto max-w-xl px-4 pb-6">
            {summary("mobile")}
          </div>
        )}
      </div>

      <div className="flex justify-end lg:border-r">
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex w-full max-w-xl flex-col gap-10 px-4 py-8 lg:px-12 lg:py-12"
        >
          <Section
            title={dictionary.contact}
            aside={
              checkout.user ? null : (
                <span className="text-sm">
                  {dictionary.have_account}{" "}
                  <Link
                    href={`/${lang}/auth/login?next=${encodeURIComponent(`/${lang}/checkout/${checkout.id}`)}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {dictionary.log_in}
                  </Link>
                </span>
              )
            }
          >
            {checkout.user && (
              <p className="text-muted-foreground -mt-1 text-sm">
                {dictionary.logged_in_as.replace("{email}", checkout.user.email)}
              </p>
            )}
            <FloatingInput
              id="email"
              type="email"
              label={dictionary.email}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              error={field_errors.email}
            />
          </Section>

          <Section title={dictionary.delivery}>
            {checkout.saved_addresses.length > 0 && (
              <FloatingSelect
                id="saved-address"
                label={dictionary.saved_addresses}
                value={saved_address_id}
                onChange={(event) => onSavedAddress(event.target.value)}
              >
                {checkout.saved_addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {[address.full_name, address.line1, address.city].filter(Boolean).join(", ")}
                  </option>
                ))}
                <option value="">{dictionary.new_address}</option>
              </FloatingSelect>
            )}
            <AddressFieldset
              prefix="shipping_address"
              value={shipping_address}
              onChange={(value) => {
                setShippingAddress(value);
                setSavedAddressId("");
              }}
              errors={field_errors}
              countries={countries}
              dictionary={dictionary}
              phone_label={is_cod ? dictionary.phone : dictionary.phone_optional}
              phone_hint={is_cod ? dictionary.phone_cod_hint : undefined}
            />
          </Section>

          <Section title={dictionary.shipping_method}>
            <RadioGroup name="shipping_method" label={dictionary.shipping_method}>
              {checkout.shipping_rates.map((rate) => (
                <RadioRow
                  key={rate.id}
                  name="shipping_method"
                  value={rate.id}
                  checked={shipping_method === rate.id}
                  onChange={() => {
                    setShippingMethod(rate.id);
                    requote({ shipping_method: rate.id });
                  }}
                  title={rate.name}
                  subtitle={dictionary.business_days
                    .replace("{min}", String(rate.min_days))
                    .replace("{max}", String(rate.max_days))}
                  aside={totals.is_free_shipping || rate.price === 0 ? dictionary.free : money(rate.price)}
                />
              ))}
            </RadioGroup>
          </Section>

          <Section title={dictionary.payment} subtitle={dictionary.payment_secure} id="payment">
            {payment_error && (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border px-3 py-3 text-sm"
              >
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {payment_error}
              </div>
            )}
            <RadioGroup name="payment_method" label={dictionary.payment}>
              {checkout.payment_methods.includes("card") && (
                <RadioRow
                  name="payment_method"
                  value="card"
                  checked={payment_method === "card"}
                  onChange={() => {
                    setPaymentMethod("card");
                    setPaymentError("");
                    requote({ payment_method: "card" });
                  }}
                  title={dictionary.card}
                  aside={<CreditCardIcon className="text-muted-foreground size-5" aria-hidden />}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FloatingInput
                        id="card-number"
                        label={dictionary.card_number}
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={card.number}
                        onChange={(event) => setCard({ ...card, number: formatCardNumber(event.target.value) })}
                        error={field_errors["card.number"]}
                        trailing={<LockIcon className="size-4" aria-hidden />}
                      />
                    </div>
                    <FloatingInput
                      id="card-expiry"
                      label={dictionary.card_expiry}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      value={card.expiry}
                      onChange={(event) => setCard({ ...card, expiry: formatExpiry(event.target.value) })}
                      error={field_errors["card.expiry"]}
                    />
                    <FloatingInput
                      id="card-cvc"
                      label={dictionary.card_cvc}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={card.cvc}
                      onChange={(event) => setCard({ ...card, cvc: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                      error={field_errors["card.cvc"]}
                    />
                    <div className="sm:col-span-2">
                      <FloatingInput
                        id="card-name"
                        label={dictionary.card_name}
                        autoComplete="cc-name"
                        value={card.name}
                        onChange={(event) => setCard({ ...card, name: event.target.value })}
                        error={field_errors["card.name"]}
                      />
                    </div>
                  </div>
                </RadioRow>
              )}
              {checkout.payment_methods.includes("cash_on_delivery") && (
                <RadioRow
                  name="payment_method"
                  value="cash_on_delivery"
                  checked={is_cod}
                  onChange={() => {
                    setPaymentMethod("cash_on_delivery");
                    setPaymentError("");
                    requote({ payment_method: "cash_on_delivery" });
                  }}
                  title={dictionary.cod}
                >
                  <p className="text-muted-foreground text-sm">
                    {dictionary.cod_body}
                    {checkout.cod_fee > 0 && ` ${dictionary.cod_fee.replace("{amount}", money(checkout.cod_fee))}`}
                  </p>
                </RadioRow>
              )}
            </RadioGroup>
          </Section>

          <Section title={dictionary.billing}>
            <RadioGroup name="billing" label={dictionary.billing}>
              <RadioRow
                name="billing"
                value="same"
                checked={is_billing_same}
                onChange={() => setIsBillingSame(true)}
                title={dictionary.billing_same}
              />
              <RadioRow
                name="billing"
                value="different"
                checked={!is_billing_same}
                onChange={() => setIsBillingSame(false)}
                title={dictionary.billing_different}
              >
                <AddressFieldset
                  prefix="billing_address"
                  value={billing_address}
                  onChange={setBillingAddress}
                  errors={field_errors}
                  countries={countries}
                  dictionary={dictionary}
                  phone_label={dictionary.phone_optional}
                />
              </RadioRow>
            </RadioGroup>
          </Section>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="note" className="text-muted-foreground text-sm">
              {dictionary.note}
            </label>
            <textarea
              id="note"
              rows={2}
              value={note}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              className="border-input bg-background focus:border-ring focus:ring-ring/40 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-6">
            <Button
              type="submit"
              size="lg"
              className="h-14 w-full text-base"
              disabled={complete.isPending || quote.isPending}
            >
              {complete.isPending && <Spinner aria-label={loading_label} />}
              {is_cod ? dictionary.complete_order : dictionary.pay_now}
            </Button>
            <nav className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-xs">
              <Link href={`/${lang}/terms`} className="hover:text-foreground underline-offset-4 hover:underline">
                {dictionary.policies.refund}
              </Link>
              <Link href={`/${lang}/privacy`} className="hover:text-foreground underline-offset-4 hover:underline">
                {dictionary.policies.privacy}
              </Link>
              <Link href={`/${lang}/terms`} className="hover:text-foreground underline-offset-4 hover:underline">
                {dictionary.policies.terms}
              </Link>
            </nav>
          </div>
        </form>
      </div>

      <aside aria-label={dictionary.summary} className="bg-muted/40 hidden lg:block">
        <div className="sticky top-0 w-full max-w-md px-12 py-12">{summary("desktop")}</div>
      </aside>
    </div>
  );
}

function Section({
  title,
  subtitle,
  aside,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-6">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          {aside}
        </div>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function RadioGroup({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} data-name={name} className="divide-y overflow-hidden rounded-md border">
      {children}
    </div>
  );
}

// A bordered radio row; the selected row is highlighted and reveals its details (Shopify accordion).
function RadioRow({
  name,
  value,
  checked,
  onChange,
  title,
  subtitle,
  aside,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const id = `${name}-${value}`;
  return (
    <div className={cn(checked && "bg-muted/40")}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-4 py-4 text-sm",
          checked && "ring-primary relative ring-1 ring-inset",
        )}
      >
        <input
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="accent-primary size-4 shrink-0"
        />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">{title}</span>
          {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
        </span>
        {aside && <span className="text-sm font-medium tabular-nums">{aside}</span>}
      </label>
      {checked && children && <div className="bg-muted/60 border-t px-4 py-4">{children}</div>}
    </div>
  );
}
