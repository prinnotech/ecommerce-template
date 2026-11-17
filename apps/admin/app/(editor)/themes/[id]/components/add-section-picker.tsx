"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { SectionIcon } from "./section-icon";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { SectionType } from "@repo/core/lib/schemas/theme";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";

type AddSectionPickerProps = {
  types: SectionType[];
  is_disabled: boolean;
  onAdd: (type: SectionType) => void;
  dictionary: AdminDictionary["themes"]["editor"];
};

// "Add section", like Shopify's: a searchable list with an icon and a line about each section.
export function AddSectionPicker({ types, is_disabled, onAdd, dictionary }: AddSectionPickerProps) {
  const [is_open, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = types.filter(
    (type) =>
      !needle ||
      dictionary.section_types[type].toLowerCase().includes(needle) ||
      dictionary.section_descriptions[type].toLowerCase().includes(needle),
  );

  function pick(type: SectionType) {
    onAdd(type);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <Popover open={is_open} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-primary w-fit" disabled={is_disabled}>
          <PlusIcon />
          {dictionary.add_section}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="relative border-b p-2">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.search_sections}
            aria-label={dictionary.search_sections}
            className="pl-8"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-1">
          {matches.map((type) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => pick(type)}
                className="hover:bg-muted focus-visible:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-left outline-none"
              >
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                  <SectionIcon type={type} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{dictionary.section_types[type]}</span>
                  <span className="text-muted-foreground block text-xs">{dictionary.section_descriptions[type]}</span>
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="text-muted-foreground px-2 py-6 text-center text-sm">{dictionary.no_sections_found}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
