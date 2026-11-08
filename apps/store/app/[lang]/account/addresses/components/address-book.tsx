"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AddressFormDialog } from "./address-form-dialog";
import type { Address } from "@repo/core/actions/account";
import { AddressBlock } from "@repo/core/components/address-block";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useDeleteAddress, useMyAddresses, useSetDefaultAddress } from "@repo/core/hooks/use-account";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";

type AddressBookProps = {
  lang: string;
  dictionary: Dictionary["account"]["addresses"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

// null = closed, "new" = creating, Address = editing.
type DialogState = null | "new" | Address;

export function AddressBook({ lang, dictionary, common, errors, validation }: AddressBookProps) {
  const addresses = useMyAddresses();
  const set_default = useSetDefaultAddress();
  const delete_address = useDeleteAddress();
  const [dialog, setDialog] = useState<DialogState>(null);

  function onSetDefault(id: string) {
    set_default.mutate(id, { onError: (error) => toast.error(errorText(errors, error)) });
  }

  function onDelete(id: string) {
    delete_address.mutate(id, {
      onSuccess: () => toast.success(dictionary.deleted),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{dictionary.title}</h2>
        <Button onClick={() => setDialog("new")}>
          <PlusIcon />
          {dictionary.add}
        </Button>
      </div>

      {addresses.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : addresses.isError ? (
        <p className="text-destructive text-sm">{errorText(errors, addresses.error)}</p>
      ) : addresses.data.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">{dictionary.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addresses.data.map((address) => (
            <li key={address.id}>
              <Card className="h-full">
                <CardContent className="flex flex-1 flex-col gap-3">
                  {address.is_default && (
                    <Badge variant="secondary" className="w-fit">
                      {dictionary.default_badge}
                    </Badge>
                  )}
                  <AddressBlock address={address} lang={lang} />
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDialog(address)}>
                    {dictionary.edit}
                  </Button>
                  {!address.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetDefault(address.id)}
                      disabled={set_default.isPending}
                    >
                      {dictionary.set_default}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive ml-auto">
                        {dictionary.delete}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{dictionary.delete_title}</AlertDialogTitle>
                        <AlertDialogDescription>{dictionary.delete_body}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => onDelete(address.id)}>
                          {dictionary.delete}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AddressFormDialog
        // Remount per address so the form starts from that address's values.
        key={dialog === null ? "closed" : dialog === "new" ? "new" : dialog.id}
        lang={lang}
        address={dialog !== null && dialog !== "new" ? dialog : null}
        is_open={dialog !== null}
        onOpenChange={(is_open) => !is_open && setDialog(null)}
        dictionary={dictionary}
        common={common}
        errors={errors}
        validation={validation}
      />
    </div>
  );
}
