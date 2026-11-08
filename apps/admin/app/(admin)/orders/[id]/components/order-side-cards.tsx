"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import type { AdminOrderDetail } from "@repo/core/actions/orders";
import { useUpdateInternalNote } from "@repo/core/hooks/use-orders";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";

type InternalNoteCardProps = {
  order: AdminOrderDetail;
  can_edit: boolean;
  dictionary: AdminDictionary["orders_admin"]["detail"];
  errors: AdminDictionary["errors"];
};

export function InternalNoteCard({ order, can_edit, dictionary, errors }: InternalNoteCardProps) {
  const update_note = useUpdateInternalNote();
  const [note, setNote] = useState(order.internal_note);
  const is_dirty = note !== order.internal_note;

  // Autosave 800ms after the last keystroke; "Saved" shows until the next edit (audit O5).
  useEffect(() => {
    if (!can_edit || !is_dirty) return;
    const timer = window.setTimeout(() => {
      update_note.mutate(
        { id: order.id, internal_note: note },
        { onError: (error) => toast.error(errorText(errors, error)) },
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [can_edit, is_dirty, note, order.id, update_note, errors]);

  const is_saving = update_note.isPending;
  const is_saved = update_note.isSuccess && !is_dirty;

  return (
    <SectionCard title={dictionary.internal_note} description={dictionary.internal_note_hint}>
      <label htmlFor="internal-note" className="sr-only">
        {dictionary.internal_note}
      </label>
      <Textarea
        id="internal-note"
        rows={3}
        value={note}
        maxLength={5000}
        disabled={!can_edit}
        onChange={(event) => setNote(event.target.value)}
      />
      {can_edit && (is_saving || is_saved) && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs" aria-live="polite">
          {is_saving && <Spinner aria-hidden />}
          {is_saved && dictionary.saved}
        </p>
      )}
    </SectionCard>
  );
}
