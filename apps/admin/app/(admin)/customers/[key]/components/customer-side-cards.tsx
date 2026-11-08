"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { useCustomerNote, useSetCustomerMarketing, useUpdateCustomerNote } from "@repo/core/hooks/use-customers";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";

type CustomerNoteCardProps = {
  customer_key: string;
  can_edit: boolean;
  dictionary: AdminDictionary["customers"];
  errors: AdminDictionary["errors"];
};

// Staff note with autosave, mirroring the order's internal note.
export function CustomerNoteCard({ customer_key, can_edit, dictionary, errors }: CustomerNoteCardProps) {
  const note_query = useCustomerNote(customer_key);
  const update_note = useUpdateCustomerNote();
  const [note, setNote] = useState<string | null>(null);
  const [seeded_note, setSeededNote] = useState<string | undefined>(undefined);

  // Seed the field once the server value has loaded (adjusting state during render, not in an effect).
  if (note === null && note_query.data !== undefined && seeded_note !== note_query.data) {
    setSeededNote(note_query.data);
    setNote(note_query.data);
  }

  const saved_note = note_query.data ?? "";
  const is_dirty = note !== null && note !== saved_note;

  useEffect(() => {
    if (!can_edit || !is_dirty) return;
    const timer = window.setTimeout(() => {
      update_note.mutate(
        { key: customer_key, note: note ?? "" },
        { onError: (error) => toast.error(errorText(errors, error)) },
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [can_edit, is_dirty, note, customer_key, update_note, errors]);

  const is_saving = update_note.isPending;
  const is_saved = update_note.isSuccess && !is_dirty;

  return (
    <SectionCard title={dictionary.note_title} description={dictionary.note_hint}>
      <label htmlFor="customer-note" className="sr-only">
        {dictionary.note_title}
      </label>
      <Textarea
        id="customer-note"
        rows={3}
        value={note ?? ""}
        maxLength={5000}
        disabled={!can_edit || note === null}
        placeholder={dictionary.note_placeholder}
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

type MarketingConsentCardProps = {
  user_id: string;
  accepts_marketing: boolean;
  can_edit: boolean;
  dictionary: AdminDictionary["customers"];
  errors: AdminDictionary["errors"];
};

export function MarketingConsentCard({
  user_id,
  accepts_marketing,
  can_edit,
  dictionary,
  errors,
}: MarketingConsentCardProps) {
  const set_marketing = useSetCustomerMarketing();
  const [value, setValue] = useState(accepts_marketing);

  function toggle(checked: boolean) {
    setValue(checked);
    set_marketing.mutate(
      { user_id, accepts_marketing: checked },
      { onError: (error) => toast.error(errorText(errors, error)) },
    );
  }

  return (
    <SectionCard title={dictionary.marketing_title} description={dictionary.marketing_hint}>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{dictionary.marketing_label}</span>
        <Switch checked={value} onCheckedChange={toggle} disabled={!can_edit} />
      </label>
    </SectionCard>
  );
}
