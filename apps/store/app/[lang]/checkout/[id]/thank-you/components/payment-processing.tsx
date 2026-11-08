"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 2000;
const SLOW_AFTER_MS = 30_000;

type PaymentProcessingProps = { title: string; body: string; slow: string };

// Shown after a card payment until Stripe's confirmation (the webhook) has created the order:
// usually a second or two. The page re-checks on its own.
export function PaymentProcessing({ title, body, slow }: PaymentProcessingProps) {
  const router = useRouter();
  const [is_slow, setIsSlow] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > SLOW_AFTER_MS) setIsSlow(true);
      router.refresh();
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div role="status" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <LoaderCircleIcon className="text-muted-foreground size-10 animate-spin" strokeWidth={1.5} aria-hidden />
      <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{is_slow ? slow : body}</p>
    </div>
  );
}
