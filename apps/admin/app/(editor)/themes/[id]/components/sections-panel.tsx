"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, type DragEvent } from "react";

import { AddSectionPicker } from "./add-section-picker";
import type { EditorContext } from "./editor-fields";
import { ColorSchemeField } from "./group-form";
import { SectionForm, type CategoryOption, type CollectionOption } from "./section-form";
import { SectionIcon } from "./section-icon";
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
import { defaultSection, duplicateSection } from "@repo/core/themes/sections";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  // The open section (null = the list). Owned by the editor, so a click in the preview opens it.
  selected_id: string | null;
  onSelect: (id: string | null) => void;
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
export function sectionTitle(section: ThemeSection, lang: string): string {
  const settings = section.settings as { heading?: unknown };
  return settings.heading ? localized(settings.heading, isLocale(lang) ? lang : LOCALES[0]) : "";
}

export function SectionsPanel({
  kind,
  title: page_title,
  sections,
  onChange,
  selected_id,
  onSelect,
  categories,
  collections,
  dictionary,
  invalid_label,
  context,
}: SectionsPanelProps) {
  const [dragging_index, setDraggingIndex] = useState<number | null>(null);
  const selected = sections.find((section) => section.id === selected_id);
  const is_full = sections.length >= MAX_SECTIONS;

  const update = (id: string, change: (section: ThemeSection) => ThemeSection) =>
    onChange(sections.map((section) => (section.id === id ? change(section) : section)));

  function add(type: SectionType) {
    const section = defaultSection(type);
    onChange([...sections, section]);
    onSelect(section.id);
  }

  function duplicate(index: number) {
    const original = sections[index];
    if (!original || is_full) return;
    const copy = duplicateSection(original);
    onChange([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)]);
    onSelect(copy.id);
  }

  function onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (dragging_index !== null) onChange(move(sections, dragging_index, index));
    setDraggingIndex(null);
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => onSelect(null)}>
          <ArrowLeftIcon />
          {page_title}
        </Button>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <SectionIcon type={selected.type} className="text-muted-foreground size-4" />
          {dictionary.section_types[selected.type]}
        </h2>
        <SectionForm
          section={selected}
          onChange={(settings) => update(selected.id, (section) => ({ ...section, settings }) as ThemeSection)}
          categories={categories}
          collections={collections}
          dictionary={dictionary}
          invalid_label={invalid_label}
          context={context}
        />
        <ColorSchemeField
          id={`section-${selected.id}-scheme`}
          value={selected.color_scheme}
          onChange={(color_scheme) => update(selected.id, (section) => ({ ...section, color_scheme }))}
          dictionary={dictionary}
          context={context}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-muted-foreground px-1 pb-1 text-xs font-medium tracking-wide uppercase">{page_title}</h2>
      <ul className="flex flex-col">
        {sections.map((section, index) => {
          const title = sectionTitle(section, context.lang);
          const is_fixed = isFixedSection(section);
          return (
            <li
              key={section.id}
              draggable={!context.is_disabled}
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, index)}
              onDragEnd={() => setDraggingIndex(null)}
              className={cn(
                "group hover:bg-muted flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-1",
                dragging_index === index && "opacity-50",
                section.is_hidden && "text-muted-foreground",
              )}
            >
              {!context.is_disabled && (
                <GripVerticalIcon
                  className="text-muted-foreground size-4 shrink-0 cursor-grab opacity-0 group-hover:opacity-100"
                  aria-label={dictionary.drag}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left"
              >
                <SectionIcon type={section.type} className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{dictionary.section_types[section.type]}</span>
                  {(title || section.is_hidden) && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {section.is_hidden ? dictionary.hidden : title}
                    </span>
                  )}
                </span>
              </button>
              {!context.is_disabled && (
                <div className="flex shrink-0 items-center">
                  {!is_fixed && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={section.is_hidden ? dictionary.show : dictionary.hide}
                      aria-pressed={section.is_hidden}
                      className={cn(
                        !section.is_hidden && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                      onClick={() => update(section.id, (item) => ({ ...item, is_hidden: !item.is_hidden }))}
                    >
                      {section.is_hidden ? <EyeOffIcon /> : <EyeIcon />}
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={dictionary.more_actions}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                      >
                        <EllipsisIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={index === 0}
                        onSelect={() => onChange(move(sections, index, index - 1))}
                      >
                        <ArrowUpIcon />
                        {dictionary.move_up}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === sections.length - 1}
                        onSelect={() => onChange(move(sections, index, index + 1))}
                      >
                        <ArrowDownIcon />
                        {dictionary.move_down}
                      </DropdownMenuItem>
                      {!is_fixed && (
                        <>
                          <DropdownMenuItem disabled={is_full} onSelect={() => duplicate(index)}>
                            <CopyIcon />
                            {dictionary.duplicate}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onChange(sections.filter((item) => item.id !== section.id))}
                          >
                            <Trash2Icon />
                            {dictionary.remove_section}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!context.is_disabled && (
        <AddSectionPicker types={sectionTypesFor(kind)} is_disabled={is_full} onAdd={add} dictionary={dictionary} />
      )}
      {is_full && (
        <p className="text-muted-foreground px-1 text-xs">
          {dictionary.max_sections.replace("{count}", String(MAX_SECTIONS))}
        </p>
      )}
    </div>
  );
}
