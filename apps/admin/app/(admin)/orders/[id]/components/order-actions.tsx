"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RefundDialog } from "./refund-dialog";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useMarkOrderPaid, useUpdateOrderStatus } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { canMarkPaid, canRefund, canTransition } from "@repo/core/lib/orders";

type Action = "processing" | "shipped" | "delivered" | "paid";

type OrderActionsProps = {
  lang: string;
  order: AdminOrderDetail;
  can_refund: boolean;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  refund_text: AdminDictionary["refund"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Next-step button plus a menu with the other allowed changes. Only valid transitions are offered;
// the server checks them again.
export function OrderActions({ lang, order, can_refund, dictionary, refund_text, common, errors }: OrderActionsProps) {
  const update_status = useUpdateOrderStatus();
  const mark_paid = useMarkOrderPaid();
  const [dialog, setDialog] = useState<null | "cancel" | "refund">(null);
  const [is_restock, setIsRestock] = useState(true);
  const is_busy = update_status.isPending || mark_paid.isPending;

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
  // Fulfillment ("shipped") is done through the Fulfill dialog on the order page, not here.
  const available: Action[] = [
    ...(["processing", "delivered"] as const).filter((status) => canTransition(order.status, status)),
    ...(canMarkPaid(order.status, order.payment_status) ? (["paid"] as const) : []),
  ];
  // The natural next step goes on the button; the rest go in the menu.
  const primary: Action | undefined =
    available.find((action) => action === "delivered") ?? available.find((action) => action === "paid") ?? available[0];
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

      <RefundDialog
        lang={lang}
        order={order}
        is_open={dialog === "refund"}
        onOpenChange={(is_open) => !is_open && setDialog(null)}
        dictionary={refund_text}
        common={common}
        errors={errors}
      />

      <AlertDialog open={dialog === "cancel"} onOpenChange={(is_open) => !is_open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dictionary.cancel_title.replace("{number}", String(order.order_number))}
            </AlertDialogTitle>
            <AlertDialogDescription>{dictionary.cancel_body}</AlertDialogDescription>
          </AlertDialogHeader>
          {
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={is_restock}
                onChange={(event) => setIsRestock(event.target.checked)}
                className="accent-primary size-4"
              />
              {dictionary.restock}
            </label>
          }
          <AlertDialogFooter>
            <AlertDialogCancel>{dictionary.keep}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => update_status.mutate({ id: order.id, status: "cancelled", is_restock }, callbacks)}
            >
              {dictionary.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
