"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { useUnsavedChanges } from "@repo/admin-ui/hooks/use-unsaved-changes";

type SaveBarProps = {
  is_dirty: boolean;
  is_saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  // Disables Save while the form has errors.
  can_save?: boolean;
  dictionary: AdminDictionary["admin_ui"]["save_bar"];
};

// Shopify's contextual save bar: one Save for the whole form, shown over the top bar only while
// something changed (audit S1). Leaving the page with unsaved changes asks first.
export function SaveBar({ is_dirty, is_saving, onSave, onDiscard, can_save = true, dictionary }: SaveBarProps) {
  useUnsavedChanges(is_dirty && !is_saving, dictionary.leave_warning);

  if (!is_dirty && !is_saving) return null;

  return (
    <div
      role="region"
      aria-label={dictionary.unsaved}
      className="bg-foreground text-background animate-in fade-in slide-in-from-top-2 fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-3 px-4 shadow-md md:px-6"
    >
      <p className="truncate text-sm font-medium">{dictionary.unsaved}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="text-background hover:bg-background/15 hover:text-background"
          onClick={onDiscard}
          disabled={is_saving}
        >
          {dictionary.discard}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={is_saving || !can_save}
          aria-label={is_saving ? dictionary.saving : undefined}
        >
          {is_saving && <Spinner aria-hidden />}
          {dictionary.save}
        </Button>
      </div>
    </div>
  );
}
