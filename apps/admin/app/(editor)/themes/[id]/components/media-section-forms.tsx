"use client";

import {
  ButtonFields,
  LocalizedField,
  NumberField,
  SelectField,
  TextInputField,
  type EditorContext,
} from "./editor-fields";
import { ImageField } from "./image-field";
import { ItemList } from "./item-list";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { MARQUEE_SPEEDS, type SectionOf } from "@repo/core/lib/schemas/theme";
import { newSectionId } from "@repo/core/themes/sections";
import { Checkbox } from "@repo/ui/components/ui/checkbox";

type EditorDictionary = AdminDictionary["themes"]["editor"];

// The sections added with theme editor v2 (slideshow, scrolling text, collection list,
// multicolumn, image banner, testimonials).
export type MediaSection = SectionOf<
  "slideshow" | "marquee" | "collection_list" | "multicolumn" | "image_banner" | "testimonials"
>;

const MEDIA_SECTION_TYPES: readonly string[] = [
  "slideshow",
  "marquee",
  "collection_list",
  "multicolumn",
  "image_banner",
  "testimonials",
];

export function isMediaSection(section: { type: string }): section is MediaSection {
  return MEDIA_SECTION_TYPES.includes(section.type);
}

type MediaSectionFormProps = {
  section: MediaSection;
  onChange: (settings: MediaSection["settings"]) => void;
  collections: { id: string; name: string }[];
  dictionary: EditorDictionary;
  invalid_label: string;
  context: EditorContext;
};

const COLUMN_COUNTS = ["2", "3", "4"] as const;

export function MediaSectionForm({
  section,
  onChange,
  collections,
  dictionary,
  invalid_label,
  context,
}: MediaSectionFormProps) {
  const fields = dictionary.fields;
  const id = (name: string) => `section-${section.id}-${name}`;
  const button_labels = {
    label: fields.button_label,
    href: fields.button_href,
    hint: fields.button_hint,
    invalid: invalid_label,
  };
  const itemLabels = (add: string) => ({
    add,
    remove: fields.remove_item,
    move_up: dictionary.move_up,
    move_down: dictionary.move_down,
  });
  const alignment_options = [
    { value: "center", label: fields.alignment_center },
    { value: "left", label: fields.alignment_left },
  ] as const;
  const height_options = [
    { value: "small", label: fields.size_small },
    { value: "medium", label: fields.size_medium },
    { value: "large", label: fields.size_large },
  ] as const;
  const column_options = COLUMN_COUNTS.map((count) => ({ value: count, label: count }));

  switch (section.type) {
    case "slideshow": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"slideshow">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <ItemList
            label={fields.slides}
            items={settings.slides}
            max={8}
            onChange={(slides) => set({ slides })}
            create={() => ({
              id: newSectionId(),
              image_url: "",
              heading: {},
              subtitle: {},
              button: { label: {}, href: "" },
            })}
            labels={itemLabels(fields.add_slide)}
            is_disabled={context.is_disabled}
            renderItem={(slide, set_slide) => (
              <>
                <ImageField
                  id={id(`slide-${slide.id}-image`)}
                  label={fields.image_url}
                  value={slide.image_url}
                  onChange={(image_url) => set_slide({ ...slide, image_url })}
                  invalid_label={invalid_label}
                  context={context}
                />
                <LocalizedField
                  id={id(`slide-${slide.id}-heading`)}
                  label={fields.heading}
                  value={slide.heading}
                  onChange={(heading) => set_slide({ ...slide, heading })}
                  context={context}
                />
                <LocalizedField
                  id={id(`slide-${slide.id}-subtitle`)}
                  label={fields.subtitle}
                  value={slide.subtitle}
                  onChange={(subtitle) => set_slide({ ...slide, subtitle })}
                  multiline
                  context={context}
                />
                <ButtonFields
                  id={id(`slide-${slide.id}-button`)}
                  label={fields.button}
                  value={slide.button}
                  onChange={(button) => set_slide({ ...slide, button })}
                  labels={button_labels}
                  context={context}
                />
              </>
            )}
          />
          <NumberField
            id={id("autoplay")}
            label={fields.autoplay}
            description={fields.autoplay_hint}
            value={settings.autoplay_seconds}
            min={0}
            max={15}
            onChange={(autoplay_seconds) => set({ autoplay_seconds })}
            context={context}
          />
          <SelectField
            id={id("height")}
            label={fields.height}
            value={settings.height}
            options={height_options}
            onChange={(height) => set({ height })}
            context={context}
          />
          <SelectField
            id={id("alignment")}
            label={fields.alignment}
            value={settings.alignment}
            options={alignment_options}
            onChange={(alignment) => set({ alignment })}
            context={context}
          />
        </div>
      );
    }

    case "marquee": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"marquee">["settings"]>) => onChange({ ...settings, ...patch });
      return (
        <div className="flex flex-col gap-5">
          <ItemList
            label={fields.marquee_items}
            items={settings.items}
            max={12}
            onChange={(items) => set({ items })}
            create={() => ({ id: newSectionId(), text: {} })}
            labels={itemLabels(fields.add_phrase)}
            is_disabled={context.is_disabled}
            renderItem={(item, set_item) => (
              <LocalizedField
                id={id(`item-${item.id}`)}
                label={fields.text}
                value={item.text}
                onChange={(text) => set_item({ ...item, text })}
                context={context}
              />
            )}
          />
          <SelectField
            id={id("speed")}
            label={fields.speed}
            value={settings.speed}
            options={MARQUEE_SPEEDS.map((speed) => ({ value: speed, label: fields[`speed_${speed}`] }))}
            onChange={(speed) => set({ speed })}
            context={context}
          />
          <SelectField
            id={id("size")}
            label={fields.text_size}
            value={settings.size}
            options={[
              { value: "small", label: fields.size_small },
              { value: "large", label: fields.size_large },
            ]}
            onChange={(size) => set({ size })}
            context={context}
          />
        </div>
      );
    }

    case "collection_list": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"collection_list">["settings"]>) => onChange({ ...settings, ...patch });
      const toggle = (collection_id: string, is_on: boolean) =>
        set({
          collection_ids: is_on
            ? [...settings.collection_ids, collection_id].slice(0, 8)
            : settings.collection_ids.filter((item) => item !== collection_id),
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
          <SelectField
            id={id("columns")}
            label={fields.columns}
            value={String(settings.columns) as (typeof COLUMN_COUNTS)[number]}
            options={column_options}
            onChange={(columns) => set({ columns: Number(columns) as 2 | 3 | 4 })}
            context={context}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{fields.collections}</legend>
            <p className="text-muted-foreground text-xs">
              {collections.length > 0 ? fields.collections_hint : fields.no_collections}
            </p>
            <ul className="flex flex-col gap-2 pt-1">
              {collections.map((collection) => {
                const checkbox_id = id(`collection-${collection.id}`);
                return (
                  <li key={collection.id} className="flex items-center gap-2">
                    <Checkbox
                      id={checkbox_id}
                      checked={settings.collection_ids.includes(collection.id)}
                      disabled={context.is_disabled}
                      onCheckedChange={(checked) => toggle(collection.id, checked === true)}
                    />
                    <label htmlFor={checkbox_id} className="text-sm">
                      {collection.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>
      );
    }

    case "multicolumn": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"multicolumn">["settings"]>) => onChange({ ...settings, ...patch });
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
            value={String(settings.columns) as (typeof COLUMN_COUNTS)[number]}
            options={column_options}
            onChange={(columns) => set({ columns: Number(columns) as 2 | 3 | 4 })}
            context={context}
          />
          <SelectField
            id={id("alignment")}
            label={fields.alignment}
            value={settings.alignment}
            options={alignment_options}
            onChange={(alignment) => set({ alignment })}
            context={context}
          />
          <ItemList
            label={fields.column_items}
            items={settings.items}
            max={8}
            onChange={(items) => set({ items })}
            create={() => ({
              id: newSectionId(),
              image_url: "",
              heading: {},
              body: {},
              button: { label: {}, href: "" },
            })}
            labels={itemLabels(fields.add_column)}
            is_disabled={context.is_disabled}
            renderItem={(item, set_item) => (
              <>
                <ImageField
                  id={id(`col-${item.id}-image`)}
                  label={fields.image_url}
                  value={item.image_url}
                  onChange={(image_url) => set_item({ ...item, image_url })}
                  invalid_label={invalid_label}
                  context={context}
                />
                <LocalizedField
                  id={id(`col-${item.id}-heading`)}
                  label={fields.heading}
                  value={item.heading}
                  onChange={(heading) => set_item({ ...item, heading })}
                  context={context}
                />
                <LocalizedField
                  id={id(`col-${item.id}-body`)}
                  label={fields.body}
                  value={item.body}
                  onChange={(body) => set_item({ ...item, body })}
                  multiline
                  context={context}
                />
                <ButtonFields
                  id={id(`col-${item.id}-button`)}
                  label={fields.button}
                  value={item.button}
                  onChange={(button) => set_item({ ...item, button })}
                  labels={button_labels}
                  context={context}
                />
              </>
            )}
          />
        </div>
      );
    }

    case "image_banner": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"image_banner">["settings"]>) => onChange({ ...settings, ...patch });
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
          <ButtonFields
            id={id("button")}
            label={fields.button}
            value={settings.button}
            onChange={(button) => set({ button })}
            labels={button_labels}
            context={context}
          />
          <SelectField
            id={id("height")}
            label={fields.height}
            value={settings.height}
            options={height_options}
            onChange={(height) => set({ height })}
            context={context}
          />
          <SelectField
            id={id("alignment")}
            label={fields.alignment}
            value={settings.alignment}
            options={alignment_options}
            onChange={(alignment) => set({ alignment })}
            context={context}
          />
          <NumberField
            id={id("overlay")}
            label={fields.overlay}
            description={fields.overlay_hint}
            value={settings.overlay}
            min={0}
            max={80}
            onChange={(overlay) => set({ overlay })}
            context={context}
          />
        </div>
      );
    }

    case "testimonials": {
      const settings = section.settings;
      const set = (patch: Partial<SectionOf<"testimonials">["settings"]>) => onChange({ ...settings, ...patch });
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
            label={fields.testimonial_items}
            items={settings.items}
            max={12}
            onChange={(items) => set({ items })}
            create={() => ({ id: newSectionId(), quote: {}, author: "", rating: 5 })}
            labels={itemLabels(fields.add_testimonial)}
            is_disabled={context.is_disabled}
            renderItem={(item, set_item) => (
              <>
                <LocalizedField
                  id={id(`t-${item.id}-quote`)}
                  label={fields.quote}
                  value={item.quote}
                  onChange={(quote) => set_item({ ...item, quote })}
                  multiline
                  context={context}
                />
                <TextInputField
                  id={id(`t-${item.id}-author`)}
                  label={fields.author}
                  value={item.author}
                  onChange={(author) => set_item({ ...item, author: author.slice(0, 80) })}
                  context={context}
                />
                <NumberField
                  id={id(`t-${item.id}-rating`)}
                  label={fields.rating}
                  value={item.rating}
                  min={0}
                  max={5}
                  onChange={(rating) => set_item({ ...item, rating })}
                  context={context}
                />
              </>
            )}
          />
        </div>
      );
    }
  }
}
