"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { FormField } from "@repo/core/components/form-field";
import { useDeleteSegment, useSaveSegment, useSegmentCount } from "@repo/core/hooks/use-customers";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { countryOptions } from "@repo/core/lib/locale/countries";
import {
  SEGMENT_FIELDS,
  defaultCondition,
  segment_input_schema,
  segment_rules_schema,
  type Segment,
  type SegmentCondition,
  type SegmentField,
  type SegmentRules,
} from "@repo/core/lib/schemas/segments";
import { formatPlural } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";

type SegmentDialogProps = {
  lang: string;
  currency: string;
  // null = a new segment.
  segment: Segment | null;
  is_open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  dictionary: AdminDictionary["customers"]["segments"];
  errors: AdminDictionary["errors"];
};

export function SegmentDialog(props: SegmentDialogProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={(is_open) => !is_open && props.onClose()}>
      {props.is_open && <SegmentForm {...props} />}
    </Dialog>
  );
}

const DEFAULT_RULES: SegmentRules = { match: "all", conditions: [defaultCondition("total_spent")] };

function SegmentForm({ lang, currency, segment, onClose, onSaved, onDeleted, dictionary, errors }: SegmentDialogProps) {
  const save = useSaveSegment();
  const remove = useDeleteSegment();
  const [name, setName] = useState(segment?.name ?? "");
  const [rules, setRules] = useState<SegmentRules>(segment?.rules ?? DEFAULT_RULES);
  const [is_confirming_delete, setIsConfirmingDelete] = useState(false);
  const valid_rules = segment_rules_schema.safeParse(rules);
  const count = useSegmentCount(valid_rules.success ? valid_rules.data : null);
  const parsed = segment_input_schema.safeParse({ name, rules });
  const onError = (error: Error) => toast.error(errorText(errors, error));

  function setCondition(index: number, condition: SegmentCondition) {
    setRules((current) => ({
      ...current,
      conditions: current.conditions.map((item, position) => (position === index ? condition : item)),
    }));
  }

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{segment ? dictionary.edit_title : dictionary.create}</DialogTitle>
        <DialogDescription>{dictionary.hint}</DialogDescription>
      </DialogHeader>

      <FormField id="segment-name" label={dictionary.name}>
        {(control) => (
          <Input
            {...control}
            value={name}
            maxLength={80}
            placeholder={dictionary.name_placeholder}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-3">
        <FormField id="segment-match" label={dictionary.match_label}>
          {(control) => (
            <NativeSelect
              {...control}
              value={rules.match}
              className="w-full sm:w-auto"
              onChange={(event) => setRules({ ...rules, match: event.target.value === "any" ? "any" : "all" })}
            >
              <NativeSelectOption value="all">{dictionary.match.all}</NativeSelectOption>
              <NativeSelectOption value="any">{dictionary.match.any}</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>

        <ul className="flex flex-col gap-2">
          {rules.conditions.map((condition, index) => (
            <li key={index} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
              <NativeSelect
                aria-label={dictionary.field_label}
                value={condition.field}
                className="w-full sm:w-48"
                onChange={(event) => {
                  const field = SEGMENT_FIELDS.find((item) => item === event.target.value) ?? "total_spent";
                  setCondition(index, defaultCondition(field as SegmentField));
                }}
              >
                {SEGMENT_FIELDS.map((field) => (
                  <NativeSelectOption key={field} value={field}>
                    {dictionary.fields[field]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <ConditionInputs
                  lang={lang}
                  currency={currency}
                  condition={condition}
                  onChange={(next) => setCondition(index, next)}
                  dictionary={dictionary}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="self-end sm:self-center"
                disabled={rules.conditions.length === 1}
                aria-label={dictionary.remove_condition}
                onClick={() =>
                  setRules({ ...rules, conditions: rules.conditions.filter((_item, position) => position !== index) })
                }
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
        {rules.conditions.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setRules({ ...rules, conditions: [...rules.conditions, defaultCondition("order_count")] })}
          >
            <PlusIcon />
            {dictionary.add_condition}
          </Button>
        )}
      </div>

      <p className="text-sm" role="status">
        {count.data
          ? `${formatPlural(count.data.count, dictionary.count, lang)} · ${formatPlural(count.data.subscribed, dictionary.subscribed_count, lang)}`
          : " "}
      </p>

      <DialogFooter className="sm:justify-between">
        {segment ? (
          is_confirming_delete ? (
            <div className="flex items-center gap-2">
              <span className="text-destructive text-sm">{dictionary.delete_confirm}</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(segment.id, {
                    onSuccess: () => {
                      toast.success(dictionary.deleted);
                      onDeleted();
                      onClose();
                    },
                    onError,
                  })
                }
              >
                {dictionary.delete}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setIsConfirmingDelete(true)}
            >
              <Trash2Icon />
              {dictionary.delete}
            </Button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            {dictionary.cancel}
          </Button>
          <Button
            type="button"
            disabled={!parsed.success || save.isPending}
            onClick={() =>
              parsed.success &&
              save.mutate(
                { id: segment?.id ?? null, segment: parsed.data },
                {
                  onSuccess: ({ id }) => {
                    toast.success(dictionary.saved);
                    onSaved(id);
                    onClose();
                  },
                  onError,
                },
              )
            }
          >
            {save.isPending && <Spinner aria-label={dictionary.save} />}
            {dictionary.save}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

function ConditionInputs({
  lang,
  currency,
  condition,
  onChange,
  dictionary,
}: {
  lang: string;
  currency: string;
  condition: SegmentCondition;
  onChange: (condition: SegmentCondition) => void;
  dictionary: AdminDictionary["customers"]["segments"];
}) {
  const number = (value: string, min = 0) => Math.max(min, Math.round(Number(value)) || min);
  switch (condition.field) {
    case "total_spent":
      return (
        <>
          <NativeSelect
            aria-label={dictionary.operator_label}
            value={condition.op}
            onChange={(event) => onChange({ ...condition, op: event.target.value === "lte" ? "lte" : "gte" })}
          >
            <NativeSelectOption value="gte">{dictionary.ops.gte}</NativeSelectOption>
            <NativeSelectOption value="lte">{dictionary.ops.lte}</NativeSelectOption>
          </NativeSelect>
          <MoneyInput
            id="segment-total-spent"
            aria-label={dictionary.fields.total_spent}
            cents={condition.value}
            onChange={(value) => onChange({ ...condition, value })}
            currency={currency}
            lang={lang}
            className="w-36"
          />
        </>
      );
    case "order_count":
      return (
        <>
          <NativeSelect
            aria-label={dictionary.operator_label}
            value={condition.op}
            onChange={(event) =>
              onChange({
                ...condition,
                op: event.target.value === "lte" ? "lte" : event.target.value === "eq" ? "eq" : "gte",
              })
            }
          >
            <NativeSelectOption value="gte">{dictionary.ops.gte}</NativeSelectOption>
            <NativeSelectOption value="lte">{dictionary.ops.lte}</NativeSelectOption>
            <NativeSelectOption value="eq">{dictionary.ops.eq}</NativeSelectOption>
          </NativeSelect>
          <Input
            type="number"
            min={0}
            aria-label={dictionary.fields.order_count}
            value={condition.value}
            className="w-24"
            onChange={(event) => onChange({ ...condition, value: number(event.target.value) })}
          />
        </>
      );
    case "last_order":
    case "signed_up":
      return (
        <>
          <NativeSelect
            aria-label={dictionary.operator_label}
            value={condition.op}
            onChange={(event) =>
              onChange({ ...condition, op: event.target.value === "not_within" ? "not_within" : "within" })
            }
          >
            <NativeSelectOption value="within">{dictionary.ops.within}</NativeSelectOption>
            <NativeSelectOption value="not_within">{dictionary.ops.not_within}</NativeSelectOption>
          </NativeSelect>
          <Input
            type="number"
            min={1}
            max={3650}
            aria-label={dictionary.days}
            value={condition.value}
            className="w-24"
            onChange={(event) => onChange({ ...condition, value: Math.min(3650, number(event.target.value, 1)) })}
          />
          <span className="text-muted-foreground text-sm">{dictionary.days}</span>
        </>
      );
    case "accepts_marketing":
      return (
        <NativeSelect
          aria-label={dictionary.fields.accepts_marketing}
          value={condition.value ? "yes" : "no"}
          onChange={(event) => onChange({ ...condition, value: event.target.value === "yes" })}
        >
          <NativeSelectOption value="yes">{dictionary.yes}</NativeSelectOption>
          <NativeSelectOption value="no">{dictionary.no}</NativeSelectOption>
        </NativeSelect>
      );
    case "country":
      return (
        <>
          <NativeSelect
            aria-label={dictionary.operator_label}
            value={condition.op}
            onChange={(event) => onChange({ ...condition, op: event.target.value === "is_not" ? "is_not" : "is" })}
          >
            <NativeSelectOption value="is">{dictionary.ops.is}</NativeSelectOption>
            <NativeSelectOption value="is_not">{dictionary.ops.is_not}</NativeSelectOption>
          </NativeSelect>
          <NativeSelect
            aria-label={dictionary.fields.country}
            value={condition.value}
            className="max-w-56"
            onChange={(event) => onChange({ ...condition, value: event.target.value })}
          >
            {countryOptions(lang).map((country) => (
              <NativeSelectOption key={country.code} value={country.code}>
                {country.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      );
    case "customer_type":
      return (
        <NativeSelect
          aria-label={dictionary.fields.customer_type}
          value={condition.value}
          onChange={(event) =>
            onChange({ ...condition, value: event.target.value === "guest" ? "guest" : "registered" })
          }
        >
          <NativeSelectOption value="registered">{dictionary.registered}</NativeSelectOption>
          <NativeSelectOption value="guest">{dictionary.guest}</NativeSelectOption>
        </NativeSelect>
      );
  }
}
