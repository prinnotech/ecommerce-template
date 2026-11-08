"use client";

import { ChevronDownIcon, CircleAlertIcon, CreditCardIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { AddressFieldset, EMPTY_ADDRESS, type AddressDraft } from "./address-fieldset";
import { FloatingInput, FloatingSelect } from "./floating-field";
import { OrderSummary } from "./order-summary";
import { StripePayment } from "./stripe-payment";
import type { CheckoutView } from "@repo/core/actions/checkout";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useCompleteCheckout, useQuoteCheckout, useSaveCheckoutContact } from "@repo/core/hooks/use-cart";
import { ActionError, errorText } from "@repo/core/lib/action-result";
import type { Totals } from "@repo/core/lib/checkout/pricing";
import type { Dictionary } from "@repo/core/lib/i18n";
import { complete_checkout_schema } from "@repo/core/lib/schemas/checkout";
import { fieldErrors } from "@repo/core/lib/schemas/validation";
import { cn } from "@repo/ui/lib/utils";
import { formatCurrency } from "@repo/core/lib/utils/format";
import { isCountryCode } from "@repo/core/lib/locale/countries";
import { email_schema } from "@repo/core/lib/schemas/auth";
import { trackGoogleEvent, trackMetaEvent } from "@repo/core/lib/tracking/browser";

type CheckoutFormProps = {
  lang: string;
  checkout: CheckoutView;
  countries: { value: string; label: string }[];
  dictionary: Dictionary["checkout"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
  loading_label: string;
};

function toDraft(address: CheckoutView["saved_addresses"][number] | undefined): AddressDraft {
  if (!address) return EMPTY_ADDRESS;
  const { id: _id, is_default: _is_default, ...fields } = address;
  return { ...EMPTY_ADDRESS, ...fields };
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
  const save_contact = useSaveCheckoutContact();
  const [saved_contact, setSavedContact] = useState(checkout.email);
  // One InitiateCheckout per checkout session (the tags wait for cookie consent).
  useEffect(() => {
    const key = `checkout_tracked:${checkout.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: the event may repeat on a reload.
    }
    const value = checkout.totals.total / 100;
    trackMetaEvent("InitiateCheckout", {
      currency: checkout.currency,
      value,
      num_items: checkout.lines.reduce((sum, line) => sum + line.quantity, 0),
    });
    trackGoogleEvent("begin_checkout", { currency: checkout.currency, value });
  }, [checkout.id, checkout.currency, checkout.totals.total, checkout.lines]);
  const [saved_address_id, setSavedAddressId] = useState(default_address?.id ?? "");
  const [shipping_address, setShippingAddress] = useState<AddressDraft>(() => {
    // A draft order's invoice starts with the address the staff typed.
    const draft =
      checkout.shipping_address && !default_address
        ? { ...EMPTY_ADDRESS, ...checkout.shipping_address }
        : toDraft(default_address);
    // Pre-select the store's country so the field doesn't start on "—" (audit X9).
    if (!draft.country) draft.country = checkout.store_country;
    return draft;
  });
  const [is_billing_same, setIsBillingSame] = useState(true);
  const [billing_address, setBillingAddress] = useState<AddressDraft>({
    ...EMPTY_ADDRESS,
    country: checkout.store_country,
  });
  const [shipping_method, setShippingMethod] = useState(
    checkout.shipping_method || checkout.shipping_rates[0]?.id || "",
  );
  // The delivery country's rates (shipping zones), refreshed by each quote.
  const [shipping_rates, setShippingRates] = useState(checkout.shipping_rates);
  const [payment_method, setPaymentMethod] = useState(checkout.payment_method);
  // Set once a card payment is ready: Stripe's card form shows and the rest of the form locks,
  // since changing it would change the amount.
  const [stripe_secret, setStripeSecret] = useState("");
  const [note, setNote] = useState("");
  const [totals, setTotals] = useState<Totals>(checkout.totals);
  const [applied_code, setAppliedCode] = useState(checkout.discount_code);
  const [is_discount_invalid, setIsDiscountInvalid] = useState(false);
  const [is_gift_card_unusable, setIsGiftCardUnusable] = useState(false);
  const [gift_card, setGiftCard] = useState(checkout.gift_card);
  // What the payment method takes after the gift card.
  const to_pay = totals.total - (gift_card?.amount ?? 0);
  const [field_errors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [payment_error, setPaymentError] = useState("");
  const [is_summary_open, setIsSummaryOpen] = useState(false);

  const money = (cents: number) => formatCurrency(cents, checkout.currency, lang);
  const selected = checkout.payment_methods.find((method) => method.id === payment_method);
  const is_cod = selected?.type === "cash_on_delivery";
  const is_card = selected?.type === "stripe";
  const is_locked = Boolean(stripe_secret);

  function requote(
    patch: {
      shipping_method?: string;
      payment_method?: string;
      discount_code?: string;
      gift_card_code?: string;
      country?: string;
    },
    // Called when a typed code was accepted (the summary then clears its field).
    on_code_applied?: () => void,
  ) {
    const next = {
      shipping_method,
      payment_method,
      discount_code: applied_code,
      gift_card_code: gift_card?.code ?? "",
      country: shipping_address.country,
      ...patch,
    };
    quote.mutate(
      { session_id: checkout.id, ...next, country: isCountryCode(next.country) ? next.country : "" },
      {
        onSuccess: (result) => {
          setTotals(result.totals);
          setShippingRates(result.shipping_rates);
          setShippingMethod(result.shipping_method);
          setAppliedCode(result.discount_code);
          setGiftCard(result.gift_card);
          setIsDiscountInvalid(result.is_discount_invalid);
          setIsGiftCardUnusable(result.is_gift_card_unusable);
          if (!result.is_discount_invalid && !result.is_gift_card_unusable) on_code_applied?.();
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
    const address = toDraft(checkout.saved_addresses.find((item) => item.id === id));
    setShippingAddress(address);
    if (address.country !== shipping_address.country) requote({ country: address.country });
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
      gift_card_code: gift_card?.code ?? "",
      customer_note: note,
      expected_total: totals.total,
    });
    const schema_errors = parsed.success ? {} : fieldErrors(parsed.error);
    const next_errors: Record<string, string | undefined> = Object.fromEntries(
      Object.entries(schema_errors).map(([field, key]) => [field, key ? validation[key] : undefined]),
    );
    // The courier calls before delivering.
    if (is_cod && !shipping_address.phone.trim()) next_errors["shipping_address.phone"] = validation.phone_required;
    setFieldErrors(next_errors);
    if (!parsed.success || Object.keys(next_errors).length > 0) {
      toast.error(dictionary.fix_errors);
      return;
    }

    complete.mutate(parsed.data, {
      onSuccess: (result) => {
        if (result.kind === "stripe") {
          setStripeSecret(result.client_secret);
          document.getElementById("payment")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        router.replace(`/${lang}/checkout/${checkout.id}/thank-you`);
      },
      onError: (error) => {
        const code = error instanceof ActionError ? error.code : "generic";
        if (code === "card_declined" || code === "payment_unavailable") {
          setPaymentError(errors[code]);
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
      gift_card={gift_card}
      onRemoveGiftCard={is_locked ? undefined : () => requote({ gift_card_code: "" })}
      is_discount_invalid={is_discount_invalid || is_gift_card_unusable}
      is_quoting={quote.isPending}
      onApplyDiscount={
        checkout.is_draft ? undefined : (code, on_applied) => requote({ discount_code: code }, on_applied)
      }
      dictionary={dictionary}
      invalid_discount_label={is_gift_card_unusable ? errors.gift_card_unusable : errors.invalid_discount}
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
          <fieldset disabled={is_locked} className="contents disabled:opacity-70">
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
                onBlur={() => {
                  const typed = email.trim().toLowerCase();
                  if (typed === saved_contact || !email_schema.safeParse(typed).success) return;
                  setSavedContact(typed);
                  save_contact.mutate({ session_id: checkout.id, email: typed });
                }}
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
                  if (value.country !== shipping_address.country) requote({ country: value.country });
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
                {shipping_rates.length === 0 && (
                  <p className="text-destructive text-sm" role="alert">
                    {errors.shipping_unavailable}
                  </p>
                )}
                {shipping_rates.map((rate) => (
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
          </fieldset>

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
              {checkout.payment_methods.map((method) => (
                <RadioRow
                  key={method.id}
                  name="payment_method"
                  value={method.id}
                  checked={payment_method === method.id}
                  disabled={is_locked}
                  onChange={() => {
                    setPaymentMethod(method.id);
                    setPaymentError("");
                    requote({ payment_method: method.id });
                  }}
                  title={method.name}
                  aside={
                    method.type === "stripe" ? (
                      <CreditCardIcon className="text-muted-foreground size-5" aria-hidden />
                    ) : method.fee > 0 ? (
                      `+${money(method.fee)}`
                    ) : undefined
                  }
                >
                  {method.type === "stripe" ? (
                    stripe_secret ? (
                      <StripePayment
                        publishable_key={checkout.stripe_publishable_key}
                        client_secret={stripe_secret}
                        email={email}
                        amount_label={dictionary.pay_amount.replace("{amount}", money(to_pay))}
                        dictionary={dictionary}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">{dictionary.card_next_step}</p>
                    )
                  ) : (
                    <div className="text-muted-foreground flex flex-col gap-1 text-sm">
                      {method.instructions && <p className="whitespace-pre-line">{method.instructions}</p>}
                      {method.fee > 0 && <p>{dictionary.method_fee.replace("{amount}", money(method.fee))}</p>}
                    </div>
                  )}
                </RadioRow>
              ))}
            </RadioGroup>
          </Section>

          <fieldset disabled={is_locked} className="contents disabled:opacity-70">
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
          </fieldset>

          <div className="flex flex-col gap-6">
            {is_locked ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 w-full"
                onClick={() => setStripeSecret("")}
              >
                {dictionary.edit_details}
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full text-base"
                disabled={complete.isPending || quote.isPending || !selected}
              >
                {complete.isPending && <Spinner aria-label={loading_label} />}
                {is_card && to_pay > 0 ? dictionary.pay_now : dictionary.complete_order}
              </Button>
            )}
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
  disabled,
  title,
  subtitle,
  aside,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
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
          disabled={disabled}
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
