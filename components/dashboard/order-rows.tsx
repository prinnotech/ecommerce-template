"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { AdminOrderRow } from "@/app/actions/orders";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

type OrderRowsProps = {
  lang: string;
  orders: AdminOrderRow[];
  dictionary: Dictionary["orders_admin"];
  order_status: Dictionary["order_status"];
  payment_status: Dictionary["payment_status"];
  is_compact?: boolean;
};

// Stripe-style order table, shared by the orders list and the dashboard's recent orders.
export function OrderRows({ lang, orders, dictionary, order_status, payment_status, is_compact }: OrderRowsProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">{dictionary.columns.order}</TableHead>
          <TableHead className="hidden md:table-cell">{dictionary.columns.date}</TableHead>
          <TableHead>{dictionary.columns.customer}</TableHead>
          <TableHead className="hidden sm:table-cell">{dictionary.columns.payment}</TableHead>
          <TableHead className="hidden sm:table-cell">{dictionary.columns.status}</TableHead>
          {!is_compact && <TableHead className="hidden lg:table-cell">{dictionary.columns.items}</TableHead>}
          <TableHead className="pr-4 text-right">{dictionary.columns.total}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const href = `/${lang}/dashboard/orders/${order.id}`;
          return (
            <TableRow key={order.id} className="cursor-pointer" onClick={() => router.push(href)}>
              <TableCell className="pl-4">
                <Link href={href} className="font-medium hover:underline" onClick={(event) => event.stopPropagation()}>
                  #{order.order_number}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                {formatDateTime(order.created_at, lang)}
              </TableCell>
              <TableCell>
                <div className="flex max-w-56 flex-col">
                  <span className="truncate text-sm font-medium">{order.customer_name}</span>
                  {!is_compact && <span className="text-muted-foreground truncate text-xs">{order.email}</span>}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <PaymentStatusBadge status={order.payment_status} label={payment_status[order.payment_status]} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <OrderStatusBadge status={order.status} label={order_status[order.status]} />
              </TableCell>
              {!is_compact && (
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {dictionary.items_count.replace("{count}", String(order.item_count))}
                </TableCell>
              )}
              <TableCell className="pr-4 text-right font-medium tabular-nums">
                {formatCurrency(order.total, order.currency, lang)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
