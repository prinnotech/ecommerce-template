"use client";

import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import type { Dictionary } from "@repo/core/lib/i18n";

const CONFIRM_TIMEOUT_MS = 25_000;

type StripePaymentProps = {
  publishable_key: string;
  client_secret: string;
  email: string;
  amount_label: string;
  dictionary: Dictionary["checkout"];
};

// Stripe's card form (Payment Element) and Apple Pay / Google Pay (Express Checkout) for the
// Checkout Session the server just created. On success Stripe sends the customer to the session's
// return_url (the thank-you page); the webhook is what records the payment and places the order.
export function StripePayment({ publishable_key, client_secret, email, amount_label, dictionary }: StripePaymentProps) {
  // Loaded once per key: Stripe.js must not be loaded again on every render.
  const [stripe_promise] = useState(() => loadStripe(publishable_key));
  return (
    <CheckoutElementsProvider stripe={stripe_promise} key={client_secret} options={{ clientSecret: client_secret }}>
      <PaymentForm email={email} amount_label={amount_label} dictionary={dictionary} />
    </CheckoutElementsProvider>
  );
}

function PaymentForm({
  email,
  amount_label,
  dictionary,
}: Omit<StripePaymentProps, "publishable_key" | "client_secret">) {
  const checkout_state = useCheckoutElements();
  const [is_processing, setIsProcessing] = useState(false);
  const [payment_error, setPaymentError] = useState("");
  const timeout_ref = useRef<number | null>(null);

  useEffect(() => () => window.clearTimeout(timeout_ref.current ?? undefined), []);

  async function confirmPayment(express_event?: StripeExpressCheckoutElementConfirmEvent) {
    if (checkout_state.type !== "success") return;
    setPaymentError("");
    setIsProcessing(true);
    timeout_ref.current = window.setTimeout(() => {
      setIsProcessing(false);
      setPaymentError(dictionary.payment_timeout);
    }, CONFIRM_TIMEOUT_MS);

    const result = await checkout_state.checkout.confirm({
      email,
      ...(express_event && { expressCheckoutConfirmEvent: express_event }),
    });

    window.clearTimeout(timeout_ref.current ?? undefined);
    if (result.type === "error") {
      setPaymentError(result.error.message);
      setIsProcessing(false);
    }
  }

  if (checkout_state.type === "loading") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner />
        {dictionary.preparing_payment}
      </p>
    );
  }
  if (checkout_state.type === "error") {
    return <p className="text-destructive text-sm">{checkout_state.error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ExpressCheckoutElement onConfirm={(event) => void confirmPayment(event)} />
      <PaymentElement options={{ layout: "tabs" }} />
      {payment_error && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {payment_error}
        </p>
      )}
      <Button
        type="button"
        size="lg"
        className="h-14 w-full text-base"
        disabled={is_processing}
        onClick={() => void confirmPayment()}
      >
        {is_processing && <Spinner />}
        {is_processing ? dictionary.processing : amount_label}
      </Button>
    </div>
  );
}
