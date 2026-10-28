import { Badge } from "@/components/ui/badge";
import type { OrdersPaymentStatusOptions, OrdersStatusOptions } from "@/types/pocketbase-types";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const ORDER_STATUS_VARIANT: Record<OrdersStatusOptions, BadgeVariant> = {
  pending: "outline",
  paid: "secondary",
  processing: "secondary",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
  refunded: "outline",
};

const PAYMENT_STATUS_VARIANT: Record<OrdersPaymentStatusOptions, BadgeVariant> = {
  unpaid: "outline",
  paid: "secondary",
  failed: "destructive",
  refunded: "outline",
};

export function OrderStatusBadge({ status, label }: { status: OrdersStatusOptions; label: string }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{label}</Badge>;
}

export function PaymentStatusBadge({ status, label }: { status: OrdersPaymentStatusOptions; label: string }) {
  return <Badge variant={PAYMENT_STATUS_VARIANT[status]}>{label}</Badge>;
}
