import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { OrderSummary } from "@/app/actions/account";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import type { Dictionary } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type OrderListProps = {
  lang: string;
  orders: OrderSummary[];
  default_currency: string;
  dictionary: Dictionary["account"]["orders"];
  order_status: Dictionary["order_status"];
  payment_status: Dictionary["payment_status"];
};

// One row per order: works on phones (stacked) and desktop (single line).
export function OrderList({
  lang,
  orders,
  default_currency,
  dictionary,
  order_status,
  payment_status,
}: OrderListProps) {
  return (
    <ul className="divide-y">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/${lang}/account/orders/${order.id}`}
            className="hover:bg-muted/50 -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-6">
              <span className="font-medium">
                {dictionary.order_number.replace("{number}", String(order.order_number))}
              </span>
              <span className="text-muted-foreground text-sm">{formatDate(order.created_at, lang)}</span>
              <span className="flex gap-1.5">
                <OrderStatusBadge status={order.status} label={order_status[order.status]} />
                <PaymentStatusBadge status={order.payment_status} label={payment_status[order.payment_status]} />
              </span>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {formatCurrency(order.total, order.currency || default_currency, lang)}
            </span>
            <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
