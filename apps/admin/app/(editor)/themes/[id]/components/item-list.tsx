"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@repo/ui/components/ui/button";

type ItemListProps<T extends { id: string }> = {
  label: string;
  items: T[];
  max: number;
  onChange: (items: T[]) => void;
  create: () => T;
  renderItem: (item: T, onItemChange: (item: T) => void, index: number) => ReactNode;
  labels: { add: string; remove: string; move_up: string; move_down: string };
  is_disabled: boolean;
};

// Repeatable rows inside a section (FAQ questions, gallery images): add, remove, reorder.
export function ItemList<T extends { id: string }>({
  label,
  items,
  max,
  onChange,
  create,
  renderItem,
  labels,
  is_disabled,
}: ItemListProps<T>) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pb-1 text-sm font-medium">{label}</legend>
      {items.map((item, index) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3">
          {renderItem(item, (next) => onChange(items.map((row) => (row.id === item.id ? next : row))), index)}
          {!is_disabled && (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={labels.move_up}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={labels.move_down}
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={labels.remove}
                onClick={() => onChange(items.filter((row) => row.id !== item.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
          )}
        </div>
      ))}
      {!is_disabled && items.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...items, create()])}
        >
          <PlusIcon />
          {labels.add}
        </Button>
      )}
    </fieldset>
  );
}
