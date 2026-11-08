"use client";

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
import { Spinner } from "@repo/ui/components/ui/spinner";

type ConfirmDialogProps = {
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  title: string;
  body: React.ReactNode;
  confirm_label: string;
  cancel_label: string;
  onConfirm: () => void;
  is_pending?: boolean;
  is_destructive?: boolean;
};

// Every delete and irreversible bulk action asks first (audit C1).
export function ConfirmDialog({
  is_open,
  onOpenChange,
  title,
  body,
  confirm_label,
  cancel_label,
  onConfirm,
  is_pending,
  is_destructive,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={is_open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={is_pending}>{cancel_label}</AlertDialogCancel>
          <AlertDialogAction
            variant={is_destructive ? "destructive" : "default"}
            disabled={is_pending}
            onClick={(event) => {
              // Stay open until the caller closes it (after the action succeeds).
              event.preventDefault();
              onConfirm();
            }}
          >
            {is_pending && <Spinner aria-hidden />}
            {confirm_label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
