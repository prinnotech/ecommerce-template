"use client";

import {
  ButtonFields,
  LocalizedField,
  NumberField,
  SelectField,
  TextInputField,
  SwitchField,
  type EditorContext,
} from "./editor-fields";
import { ImageField } from "./image-field";
import { ItemList } from "./item-list";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { PRODUCT_SOURCES, type SectionOf, type ThemeSection } from "@repo/core/lib/schemas/theme";
import { newSectionId } from "@repo/core/themes/sections";
import { Checkbox } from "@repo/ui/components/ui/checkbox";

export type CategoryOption = { id: string; slug: string; name: string; is_top_level: boolean };
export type CollectionOption = { id: string; name: string };

type EditorDictionary = AdminDictionary["themes"]["editor"];

type SectionFormProps = {
  section: ThemeSection;
  onChange: (settings: ThemeSection["settings"]) => void;
  categories: CategoryOption[];
  collections: CollectionOption[];
  dictionary: EditorDictionary;
  invalid_label: string;
  context: EditorContext;
};

// The settings form for one section; which fields depends on its type.
export function SectionForm({
  section,
  onChange,
  categories,
  collections,
  dictionary,
  invalid_label,
  context,
}: SectionFormProps) {
  const fields = dictionary.fields;
  const id = (name: string) => `section-${section.id}-${name}`;
  const button_labels = {
    label: fields.button_label,
    href: fields.button_href,
    hint: fields.button_hint,
    invalid: invalid_label,
  };

  switch (section.type) {
    case "hero": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"hero">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <LocalizedField
            id={id("subtitle")}
            label={fields.subtitle}
            value={settings.subtitle}
            onChange={(subtitle) => set({ subtitle })}
            multiline
            context={context}
          />
          <ImageField
            id={id("image")}
            label={fields.image_url}
            value={settings.image_url}
            onChange={(image_url) => set({ image_url })}
            description={fields.image_hint}
            invalid_label={invalid_label}
            context={context}
          />
          <SelectField
            id={id("alignment")}
            label={fields.alignment}
            value={settings.alignment}
            options={[
              { value: "center", label: fields.alignment_center },
              { value: "left", label: fields.alignment_left },
            ]}
            onChange={(alignment) => set({ alignment })}
            context={context}
          />
          <SelectField
            id={id("size")}
            label={fields.size}
            value={settings.size}
            options={[
              { value: "medium", label: fields.size_medium },
              { value: "large", label: fields.size_large },
            ]}
            onChange={(size) => set({ size })}
            context={context}
          />
          <ButtonFields
            id={id("primary")}
            label={fields.primary_button}
            value={settings.primary_button}
            onChange={(primary_button) => set({ primary_button })}
            labels={button_labels}
            context={context}
          />
          <ButtonFields
            id={id("secondary")}
            label={fields.secondary_button}
            value={settings.secondary_button}
            onChange={(secondary_button) => set({ secondary_button })}
            labels={button_labels}
            context={context}
          />
        </div>
      );
    }

    case "trust_badges":
      return <p className="text-muted-foreground text-sm">{fields.no_settings}</p>;

    case "category_tiles": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"category_tiles">["settings"]>) => onChange({ ...settings, ...patch });
      const toggle = (category_id: string, is_checked: boolean) =>
        set({
          category_ids: is_checked
            ? [...settings.category_ids, category_id].slice(0, 8)
            : settings.category_ids.filter((item) => item !== category_id),
        });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <NumberField
            id={id("limit")}
            label={fields.limit}
            value={settings.limit}
            min={2}
            max={8}
            onChange={(limit) => set({ limit })}
            context={context}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{fields.categories}</legend>
            <p className="text-muted-foreground text-xs">{fields.categories_hint}</p>
            <ul className="flex flex-col gap-2 pt-1">
              {categories.map((category) => {
                const checkbox_id = id(`category-${category.id}`);
                return (
                  <li key={category.id} className="flex items-center gap-2">
                    <Checkbox
                      id={checkbox_id}
                      checked={settings.category_ids.includes(category.id)}
                      disabled={context.is_disabled}
                      onCheckedChange={(checked) => toggle(category.id, checked === true)}
                    />
                    <label htmlFor={checkbox_id} className="text-sm">
                      {category.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>
      );
    }

    case "product_grid": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"product_grid">["settings"]>) => onChange({ ...settings, ...patch });
      const source_labels = {
        featured: fields.source_featured,
        newest: fields.source_newest,
        category: fields.source_category,
        collection: fields.source_collection,
      };
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <SelectField
            id={id("source")}
            label={fields.source}
            value={settings.source}
            options={PRODUCT_SOURCES.map((source) => ({ value: source, label: source_labels[source] }))}
            onChange={(source) => set({ source })}
            context={context}
          />
          {settings.source === "category" && (
            <SelectField
              id={id("category")}
              label={fields.category}
              value={settings.category_id}
              options={[
                { value: "", label: fields.choose_category },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
              onChange={(category_id) => set({ category_id })}
              context={context}
            />
          )}
          {settings.source === "collection" && (
            <SelectField
              id={id("collection")}
              label={fields.collection}
              value={settings.collection_id}
              options={[
                { value: "", label: fields.choose_collection },
                ...collections.map((collection) => ({ value: collection.id, label: collection.name })),
              ]}
              onChange={(collection_id) => set({ collection_id })}
              context={context}
            />
          )}
          <NumberField
            id={id("limit")}
            label={fields.limit}
            value={settings.limit}
            min={2}
            max={12}
            onChange={(limit) => set({ limit })}
            context={context}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id={id("view-all")}
              checked={settings.show_view_all}
              disabled={context.is_disabled}
              onCheckedChange={(checked) => set({ show_view_all: checked === true })}
            />
            <label htmlFor={id("view-all")} className="text-sm">
              {fields.show_view_all}
            </label>
          </div>
        </div>
      );
    }

    case "image_with_text": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"image_with_text">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <ImageField
            id={id("image")}
            label={fields.image_url}
            value={settings.image_url}
            onChange={(image_url) => set({ image_url })}
            description={fields.image_hint}
            invalid_label={invalid_label}
            context={context}
          />
          <SelectField
            id={id("position")}
            label={fields.image_position}
            value={settings.image_position}
            options={[
              { value: "left", label: fields.position_left },
              { value: "right", label: fields.position_right },
            ]}
            onChange={(image_position) => set({ image_position })}
            context={context}
          />
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <LocalizedField
            id={id("body")}
            label={fields.body}
            value={settings.body}
            onChange={(body) => set({ body })}
            description={fields.body_hint}
            multiline
            context={context}
          />
          <ButtonFields
            id={id("button")}
            label={fields.button}
            value={settings.button}
            onChange={(button) => set({ button })}
            labels={button_labels}
            context={context}
          />
        </div>
      );
    }

    case "rich_text": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"rich_text">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <LocalizedField
            id={id("body")}
            label={fields.body}
            value={settings.body}
            onChange={(body) => set({ body })}
            description={fields.body_hint}
            multiline
            context={context}
          />
          <SelectField
            id={id("alignment")}
            label={fields.alignment}
            value={settings.alignment}
            options={[
              { value: "center", label: fields.alignment_center },
              { value: "left", label: fields.alignment_left },
            ]}
            onChange={(alignment) => set({ alignment })}
            context={context}
          />
        </div>
      );
    }

    case "faq": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"faq">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <ItemList
            label={fields.faq_items}
            items={settings.items}
            max={30}
            onChange={(items) => set({ items })}
            create={() => ({ id: newSectionId(), question: {}, answer: {} })}
            labels={{
              add: fields.add_question,
              remove: fields.remove_item,
              move_up: dictionary.move_up,
              move_down: dictionary.move_down,
            }}
            is_disabled={context.is_disabled}
            renderItem={(item, set_item) => (
              <>
                <LocalizedField
                  id={id(`q-${item.id}`)}
                  label={fields.question}
                  value={item.question}
                  onChange={(question) => set_item({ ...item, question })}
                  context={context}
                />
                <LocalizedField
                  id={id(`a-${item.id}`)}
                  label={fields.answer}
                  value={item.answer}
                  onChange={(answer) => set_item({ ...item, answer })}
                  multiline
                  context={context}
                />
              </>
            )}
          />
        </div>
      );
    }

    case "gallery": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"gallery">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <SelectField
            id={id("columns")}
            label={fields.columns}
            value={String(settings.columns) as "2" | "3" | "4"}
            options={[
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
            ]}
            onChange={(columns) => set({ columns: Number(columns) as 2 | 3 | 4 })}
            context={context}
          />
          <ItemList
            label={fields.images}
            items={settings.images}
            max={12}
            onChange={(images) => set({ images })}
            create={() => ({ id: newSectionId(), image_url: "", caption: {}, href: "" })}
            labels={{
              add: fields.add_image,
              remove: fields.remove_item,
              move_up: dictionary.move_up,
              move_down: dictionary.move_down,
            }}
            is_disabled={context.is_disabled}
            renderItem={(item, set_item) => (
              <>
                <ImageField
                  id={id(`img-${item.id}`)}
                  label={fields.image_url}
                  value={item.image_url}
                  onChange={(image_url) => set_item({ ...item, image_url })}
                  invalid_label={invalid_label}
                  context={context}
                />
                <LocalizedField
                  id={id(`cap-${item.id}`)}
                  label={fields.caption}
                  value={item.caption}
                  onChange={(caption) => set_item({ ...item, caption })}
                  context={context}
                />
                <TextInputField
                  id={id(`href-${item.id}`)}
                  label={fields.button_href}
                  value={item.href}
                  onChange={(href) => set_item({ ...item, href })}
                  is_url
                  invalid_label={invalid_label}
                  context={context}
                />
              </>
            )}
          />
        </div>
      );
    }

    case "video": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"video">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <TextInputField
            id={id("url")}
            label={fields.video_url}
            value={settings.url}
            onChange={(url) => set({ url })}
            description={fields.video_hint}
            is_url
            invalid_label={invalid_label}
            context={context}
          />
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <LocalizedField
            id={id("caption")}
            label={fields.caption}
            value={settings.caption}
            onChange={(caption) => set({ caption })}
            context={context}
          />
        </div>
      );
    }

    case "spacer": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"spacer">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <SelectField
            id={id("size")}
            label={fields.size}
            value={settings.size}
            options={[
              { value: "small", label: fields.size_small },
              { value: "medium", label: fields.size_medium },
              { value: "large", label: fields.size_large },
            ]}
            onChange={(size) => set({ size })}
            context={context}
          />
          <SwitchField
            id={id("divider")}
            label={fields.show_divider}
            checked={settings.show_divider}
            onChange={(show_divider) => set({ show_divider })}
            context={context}
          />
        </div>
      );
    }

    case "page_header": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"page_header">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("eyebrow")}
            label={fields.eyebrow}
            value={settings.eyebrow}
            onChange={(eyebrow) => set({ eyebrow })}
            context={context}
          />
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <LocalizedField
            id={id("subtitle")}
            label={fields.subtitle}
            value={settings.subtitle}
            onChange={(subtitle) => set({ subtitle })}
            multiline
            context={context}
          />
          <SelectField
            id={id("alignment")}
            label={fields.alignment}
            value={settings.alignment}
            options={[
              { value: "left", label: fields.alignment_left },
              { value: "center", label: fields.alignment_center },
            ]}
            onChange={(alignment) => set({ alignment })}
            context={context}
          />
        </div>
      );
    }

    case "contact_form": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"contact_form">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <SwitchField
            id={id("details")}
            label={fields.show_details}
            description={fields.show_details_hint}
            checked={settings.show_details}
            onChange={(show_details) => set({ show_details })}
            context={context}
          />
        </div>
      );
    }

    case "product_main": {
      const settings = section.settings;
      return (
        <div className="flex flex-col gap-5">
          <p className="text-muted-foreground text-sm">{fields.product_main_hint}</p>
          <SwitchField
            id={id("assurances")}
            label={fields.show_assurances}
            checked={settings.show_assurances}
            onChange={(show_assurances) => onChange({ ...settings, show_assurances })}
            context={context}
          />
        </div>
      );
    }

    case "related_products": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"related_products">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <NumberField
            id={id("limit")}
            label={fields.limit}
            value={settings.limit}
            min={2}
            max={12}
            onChange={(limit) => set({ limit })}
            context={context}
          />
        </div>
      );
    }

    case "newsletter": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"newsletter">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <LocalizedField
            id={id("heading")}
            label={fields.heading}
            value={settings.heading}
            onChange={(heading) => set({ heading })}
            context={context}
          />
          <LocalizedField
            id={id("body")}
            label={fields.body}
            value={settings.body}
            onChange={(body) => set({ body })}
            multiline
            context={context}
          />
        </div>
      );
    }
  }
}
