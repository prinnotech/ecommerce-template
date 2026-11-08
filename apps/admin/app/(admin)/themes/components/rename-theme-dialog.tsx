"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@repo/core/components/form-field";
import type { ThemeSummary } from "@repo/core/actions/themes";
import { useRenameTheme } from "@repo/core/hooks/use-themes";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { theme_name_schema } from "@repo/core/lib/schemas/theme";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";

type RenameThemeDialogProps = {
  theme: ThemeSummary | null;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: AdminDictionary["themes"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

export function RenameThemeDialog({
  theme,
  is_open,
  onOpenChange,
  dictionary,
  common,
  errors,
  validation,
}: RenameThemeDialogProps) {
  const rename = useRenameTheme();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const name_error = field_errors.name ? validation[field_errors.name] : undefined;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!theme) return;
    const parsed = theme_name_schema.safeParse(String(new FormData(event.currentTarget).get("name") ?? ""));
    if (!parsed.success) {
      setFieldErrors({ name: fieldErrors(parsed.error)[""] ?? "invalid" });
      return;
    }
    setFieldErrors({});
    rename.mutate(
      { id: theme.id, name: parsed.data },
      {
        onSuccess: () => {
          toast.success(dictionary.renamed);
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{dictionary.rename_title}</DialogTitle>
          </DialogHeader>
          <FormField id="theme-name" label={dictionary.name_label} error={name_error}>
            {(control) => (
              <Input {...control} name="name" key={theme?.id} defaultValue={theme?.name ?? ""} maxLength={60} />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common.cancel}
            </Button>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending && <Spinner />}
              {dictionary.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
