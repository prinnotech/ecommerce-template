"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ORDER_TONE, PAYMENT_TONE } from "@/components/order-status-tone";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { AdminOrderRow } from "@repo/core/actions/orders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { formatCurrency, formatDateTime, formatPlural } from "@repo/core/lib/utils/format";

type OrderRowsProps = {
  lang: string;
  orders: AdminOrderRow[];
  dictionary: AdminDictionary["orders_admin"];
  order_status: AdminDictionary["order_status"];
  payment_status: AdminDictionary["payment_status"];
  is_compact?: boolean;
  // Off on a customer's page, where every row would repeat the same name.
  show_customer?: boolean;
};

// Small order table for the home page's recent orders and a customer's orders (the orders list
// itself uses IndexTable). Same badge tones as the orders list.
export function OrderRows({
  lang,
  orders,
  dictionary,
  order_status,
  payment_status,
  is_compact,
  show_customer = true,
}: OrderRowsProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">{dictionary.columns.order}</TableHead>
          <TableHead className="hidden sm:table-cell">{dictionary.columns.date}</TableHead>
          {show_customer && <TableHead>{dictionary.columns.customer}</TableHead>}
          <TableHead className={show_customer ? "hidden sm:table-cell" : undefined}>
            {dictionary.columns.payment}
          </TableHead>
          <TableHead className="hidden sm:table-cell">{dictionary.columns.status}</TableHead>
          {!is_compact && <TableHead className="hidden lg:table-cell">{dictionary.columns.items}</TableHead>}
          <TableHead className="pr-4 text-right">{dictionary.columns.total}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const href = `/orders/${order.id}`;
          return (
            <TableRow key={order.id} className="cursor-pointer" onClick={() => router.push(href)}>
              <TableCell className="pl-4">
                <Link href={href} className="font-medium hover:underline" onClick={(event) => event.stopPropagation()}>
                  #{order.order_number}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                {formatDateTime(order.created_at, lang)}
              </TableCell>
              {show_customer && (
                <TableCell>
                  <div className="flex max-w-56 flex-col">
                    <span className="truncate text-sm font-medium">{order.customer_name}</span>
                    {!is_compact && <span className="text-muted-foreground truncate text-xs">{order.email}</span>}
                  </div>
                </TableCell>
              )}
              <TableCell className={show_customer ? "hidden sm:table-cell" : undefined}>
                <StatusBadge tone={PAYMENT_TONE[order.payment_status]}>
                  {payment_status[order.payment_status]}
                </StatusBadge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <StatusBadge tone={ORDER_TONE[order.status]}>{order_status[order.status]}</StatusBadge>
              </TableCell>
              {!is_compact && (
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {formatPlural(order.item_count, dictionary.items_count, lang)}
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
