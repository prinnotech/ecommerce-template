"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, type DragEvent } from "react";

import type { EditorContext } from "./editor-fields";
import { SectionForm, type CategoryOption, type CollectionOption } from "./section-form";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import {
  isFixedSection,
  MAX_SECTIONS,
  sectionTypesFor,
  type PageKind,
  type SectionType,
  type ThemeSection,
} from "@repo/core/lib/schemas/theme";
import { isLocale, LOCALES } from "@repo/core/i18nConfig";
import { defaultSection } from "@repo/core/themes/sections";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";

type EditorDictionary = AdminDictionary["themes"]["editor"];

type SectionsPanelProps = {
  // Which page is being edited: decides the sections that can be added.
  kind: PageKind;
  title: string;
  sections: ThemeSection[];
  onChange: (sections: ThemeSection[]) => void;
  categories: CategoryOption[];
  collections: CollectionOption[];
  dictionary: EditorDictionary;
  invalid_label: string;
  context: EditorContext;
};

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// The section's own heading, so two product grids can be told apart in the list.
function sectionTitle(section: ThemeSection, lang: string): string {
  const settings = section.settings as { heading?: unknown };
  return settings.heading ? localized(settings.heading, isLocale(lang) ? lang : LOCALES[0]) : "";
}

export function SectionsPanel({
  kind,
  title: page_title,
  sections,
  onChange,
  categories,
  collections,
  dictionary,
  invalid_label,
  context,
}: SectionsPanelProps) {
  const [selected_id, setSelectedId] = useState<string | null>(null);
  const [dragging_index, setDraggingIndex] = useState<number | null>(null);
  const selected = sections.find((section) => section.id === selected_id);
  const is_full = sections.length >= MAX_SECTIONS;

  const update = (id: string, change: (section: ThemeSection) => ThemeSection) =>
    onChange(sections.map((section) => (section.id === id ? change(section) : section)));

  function add(type: SectionType) {
    const section = defaultSection(type);
    onChange([...sections, section]);
    setSelectedId(section.id);
  }

  function onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (dragging_index !== null) onChange(move(sections, dragging_index, index));
    setDraggingIndex(null);
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => setSelectedId(null)}>
          <ArrowLeftIcon />
          {dictionary.all_sections}
        </Button>
        <h2 className="text-base font-semibold">{dictionary.section_types[selected.type]}</h2>
        <SectionForm
          section={selected}
          onChange={(settings) => update(selected.id, (section) => ({ ...section, settings }) as ThemeSection)}
          categories={categories}
          collections={collections}
          dictionary={dictionary}
          invalid_label={invalid_label}
          context={context}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{page_title}</h2>
      <ul className="flex flex-col gap-1">
        {sections.map((section, index) => {
          const title = sectionTitle(section, context.lang);
          return (
            <li
              key={section.id}
              draggable={!context.is_disabled}
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, index)}
              onDragEnd={() => setDraggingIndex(null)}
              className={cn(
                "group bg-card flex items-center gap-1 rounded-md border py-1 pr-1 pl-1.5",
                dragging_index === index && "opacity-50",
                section.is_hidden && "text-muted-foreground",
              )}
            >
              {!context.is_disabled && (
                <GripVerticalIcon
                  className="text-muted-foreground size-4 shrink-0 cursor-grab"
                  aria-label={dictionary.drag}
                />
              )}
              <button
                type="button"
                onClick={() => setSelectedId(section.id)}
                className="hover:bg-muted flex min-w-0 flex-1 flex-col items-start rounded px-1.5 py-1 text-left"
              >
                <span className="truncate text-sm font-medium">{dictionary.section_types[section.type]}</span>
                {(title || section.is_hidden) && (
                  <span className="text-muted-foreground truncate text-xs">
                    {section.is_hidden ? dictionary.hidden : title}
                  </span>
                )}
              </button>
              {!context.is_disabled && (
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={dictionary.move_up}
                    disabled={index === 0}
                    onClick={() => onChange(move(sections, index, index - 1))}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={dictionary.move_down}
                    disabled={index === sections.length - 1}
                    onClick={() => onChange(move(sections, index, index + 1))}
                  >
                    <ArrowDownIcon />
                  </Button>
                  {!isFixedSection(section) && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={section.is_hidden ? dictionary.show : dictionary.hide}
                        aria-pressed={section.is_hidden}
                        onClick={() => update(section.id, (item) => ({ ...item, is_hidden: !item.is_hidden }))}
                      >
                        {section.is_hidden ? <EyeOffIcon /> : <EyeIcon />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.remove_section}
                        onClick={() => onChange(sections.filter((item) => item.id !== section.id))}
                      >
                        <Trash2Icon />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!context.is_disabled && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={is_full}>
              <PlusIcon />
              {dictionary.add_section}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {sectionTypesFor(kind).map((type) => (
              <DropdownMenuItem key={type} onSelect={() => add(type)}>
                {dictionary.section_types[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {is_full && (
        <p className="text-muted-foreground text-xs">
          {dictionary.max_sections.replace("{count}", String(MAX_SECTIONS))}
        </p>
      )}
    </div>
  );
}
