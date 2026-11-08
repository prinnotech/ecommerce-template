import { cn } from "@repo/ui/lib/utils";
import type { OrderStatus, PaymentStatus } from "@repo/core/lib/orders";
import {
  ORDER_TONE,
  PAYMENT_TONE,
  STATUS_DOT_CLASSES,
  STATUS_TONE_CLASSES,
  type StatusTone,
} from "@repo/core/lib/order-tones";

// The shop's order badges (customer account), in the same tones as the admin's StatusBadge.
function ToneBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        STATUS_TONE_CLASSES[tone],
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full border", STATUS_DOT_CLASSES[tone])} />
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <ToneBadge tone={ORDER_TONE[status]} label={label} />;
}

export function PaymentStatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
  return <ToneBadge tone={PAYMENT_TONE[status]} label={label} />;
}
