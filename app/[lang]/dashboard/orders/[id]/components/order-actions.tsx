"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AdminOrderDetail } from "@/app/actions/orders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useMarkOrderPaid, useRefundOrder, useUpdateOrderStatus } from "@/hooks/use-orders";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { canMarkPaid, canRefund, canTransition } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils/format";

type Action = "processing" | "shipped" | "delivered" | "paid";

type OrderActionsProps = {
  lang: string;
  order: AdminOrderDetail;
  can_refund: boolean;
  dictionary: Dictionary["orders_admin"]["detail"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

// Next-step button plus a menu with the other allowed changes. Only valid transitions are offered;
// the server checks them again.
export function OrderActions({ lang, order, can_refund, dictionary, common, errors }: OrderActionsProps) {
  const update_status = useUpdateOrderStatus();
  const mark_paid = useMarkOrderPaid();
  const refund = useRefundOrder();
  const [dialog, setDialog] = useState<null | "cancel" | "refund">(null);
  const [is_restock, setIsRestock] = useState(true);
  const is_busy = update_status.isPending || mark_paid.isPending || refund.isPending;

  const callbacks = {
    onSuccess: () => toast.success(dictionary.updated),
    onError: (error: Error) => toast.error(errorText(errors, error)),
  };

  const labels: Record<Action, string> = {
    processing: dictionary.mark_processing,
    shipped: dictionary.mark_shipped,
    delivered: dictionary.mark_delivered,
    paid: dictionary.mark_paid,
  };
  const available: Action[] = [
    ...(["processing", "shipped", "delivered"] as const).filter((status) => canTransition(order.status, status)),
    ...(canMarkPaid(order.status, order.payment_status) ? (["paid"] as const) : []),
  ];
  // The natural next step goes on the button; the rest go in the menu.
  const primary: Action | undefined =
    available.find((action) => action === "shipped") ??
    available.find((action) => action === "delivered") ??
    available.find((action) => action === "paid") ??
    available[0];
  const secondary = available.filter((action) => action !== primary);
  const can_cancel = canTransition(order.status, "cancelled");
  const can_refund_now = can_refund && canRefund(order.status, order.payment_status);

  function run(action: Action) {
    if (action === "paid") mark_paid.mutate({ id: order.id }, callbacks);
    else update_status.mutate({ id: order.id, status: action, is_restock: false }, callbacks);
  }

  if (!primary && !can_cancel && !can_refund_now) return null;

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button onClick={() => run(primary)} disabled={is_busy}>
          {is_busy && <Spinner aria-label={common.loading} />}
          {labels[primary]}
        </Button>
      )}
      {(secondary.length > 0 || can_cancel || can_refund_now) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={is_busy}>
              {dictionary.more_actions}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {secondary.map((action) => (
              <DropdownMenuItem key={action} onSelect={() => run(action)}>
                {labels[action]}
              </DropdownMenuItem>
            ))}
            {(can_cancel || can_refund_now) && secondary.length > 0 && <DropdownMenuSeparator />}
            {can_refund_now && (
              <DropdownMenuItem onSelect={() => setDialog("refund")}>{dictionary.refund}</DropdownMenuItem>
            )}
            {can_cancel && (
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
                {dictionary.cancel}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={dialog !== null} onOpenChange={(is_open) => !is_open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(dialog === "refund" ? dictionary.refund_title : dictionary.cancel_title).replace(
                "{number}",
                String(order.order_number),
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "refund"
                ? dictionary.refund_body.replace("{amount}", formatCurrency(order.total, order.currency, lang))
                : dictionary.cancel_body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!(dialog === "refund" && order.status === "cancelled") && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={is_restock}
                onChange={(event) => setIsRestock(event.target.checked)}
                className="accent-primary size-4"
              />
              {dictionary.restock}
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{dictionary.keep}</AlertDialogCancel>
            <AlertDialogAction
              variant={dialog === "cancel" ? "destructive" : "default"}
              onClick={() => {
                if (dialog === "refund") refund.mutate({ id: order.id, is_restock }, callbacks);
                else update_status.mutate({ id: order.id, status: "cancelled", is_restock }, callbacks);
              }}
            >
              {dictionary.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
