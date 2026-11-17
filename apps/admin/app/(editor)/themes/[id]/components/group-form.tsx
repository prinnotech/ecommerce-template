"use client";

import {
  LocalizedField,
  NumberField,
  SelectField,
  SwitchField,
  TextInputField,
  type EditorContext,
} from "./editor-fields";
import { ImageField } from "./image-field";
import { ItemList } from "./item-list";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  COLOR_SCHEMES,
  HEADER_LAYOUTS,
  type AnnouncementSettings,
  type ColorScheme,
  type FooterSettings,
  type GroupId,
  type HeaderSettings,
  type ThemeData,
} from "@repo/core/lib/schemas/theme";
import { newSectionId } from "@repo/core/themes/sections";

type EditorDictionary = AdminDictionary["themes"]["editor"];

export function ColorSchemeField({
  id,
  value,
  onChange,
  dictionary,
  context,
}: {
  id: string;
  value: ColorScheme;
  onChange: (value: ColorScheme) => void;
  dictionary: EditorDictionary;
  context: EditorContext;
}) {
  return (
    <SelectField
      id={id}
      label={dictionary.color_scheme}
      value={value}
      options={COLOR_SCHEMES.map((scheme) => ({ value: scheme, label: dictionary.color_schemes[scheme] }))}
      onChange={onChange}
      context={context}
    />
  );
}

type GroupFormProps = {
  group: GroupId;
  data: ThemeData;
  onChange: (data: ThemeData) => void;
  dictionary: EditorDictionary;
  invalid_label: string;
  context: EditorContext;
};

// The announcement bar, header and footer: the same on every page of the theme.
export function GroupForm({ group, data, onChange, dictionary, invalid_label, context }: GroupFormProps) {
  const fields = dictionary.group_fields;

  if (group === "group:announcement") {
    const value = data.header_group.announcement;
    const set = (patch: Partial<AnnouncementSettings>) =>
      onChange({ ...data, header_group: { ...data.header_group, announcement: { ...value, ...patch } } });
    return (
      <div className="flex flex-col gap-5">
        <ItemList
          label={fields.messages}
          items={value.messages}
          max={10}
          onChange={(messages) => set({ messages })}
          create={() => ({ id: newSectionId(), text: {}, href: "" })}
          labels={{
            add: fields.add_message,
            remove: dictionary.fields.remove_item,
            move_up: dictionary.move_up,
            move_down: dictionary.move_down,
          }}
          is_disabled={context.is_disabled}
          renderItem={(message, set_message) => (
            <>
              <LocalizedField
                id={`announcement-${message.id}-text`}
                label={fields.message_text}
                value={message.text}
                onChange={(text) => set_message({ ...message, text })}
                context={context}
              />
              <TextInputField
                id={`announcement-${message.id}-href`}
                label={fields.message_link}
                value={message.href}
                onChange={(href) => set_message({ ...message, href })}
                is_url
                invalid_label={invalid_label}
                context={context}
              />
            </>
          )}
        />
        <p className="text-muted-foreground text-xs">{fields.messages_hint}</p>
        <NumberField
          id="announcement-autoplay"
          label={fields.autoplay}
          description={fields.autoplay_hint}
          value={value.autoplay_seconds}
          min={0}
          max={30}
          onChange={(autoplay_seconds) => set({ autoplay_seconds })}
          context={context}
        />
        <ColorSchemeField
          id="announcement-scheme"
          value={value.color_scheme}
          onChange={(color_scheme) => set({ color_scheme })}
          dictionary={dictionary}
          context={context}
        />
      </div>
    );
  }

  if (group === "group:header") {
    const value = data.header_group.header;
    const set = (patch: Partial<HeaderSettings>) =>
      onChange({ ...data, header_group: { ...data.header_group, header: { ...value, ...patch } } });
    const settings_text = dictionary.settings;
    return (
      <div className="flex flex-col gap-5">
        <ImageField
          id="header-logo"
          label={fields.logo}
          value={value.logo_url}
          onChange={(logo_url) => set({ logo_url })}
          description={fields.logo_hint}
          invalid_label={invalid_label}
          context={context}
        />
        <NumberField
          id="header-logo-width"
          label={fields.logo_width}
          value={value.logo_width}
          min={40}
          max={320}
          onChange={(logo_width) => set({ logo_width })}
          context={context}
        />
        <SelectField
          id="header-layout"
          label={settings_text.header_layout}
          value={value.layout}
          options={HEADER_LAYOUTS.map((layout) => ({ value: layout, label: settings_text[`layout_${layout}`] }))}
          onChange={(layout) => set({ layout })}
          context={context}
        />
        <SwitchField
          id="header-sticky"
          label={fields.sticky}
          checked={value.is_sticky}
          onChange={(is_sticky) => set({ is_sticky })}
          context={context}
        />
        <SwitchField
          id="header-utility-bar"
          label={settings_text.utility_bar}
          description={settings_text.utility_bar_hint}
          checked={value.show_utility_bar}
          onChange={(show_utility_bar) => set({ show_utility_bar })}
          context={context}
        />
        <ColorSchemeField
          id="header-scheme"
          value={value.color_scheme}
          onChange={(color_scheme) => set({ color_scheme })}
          dictionary={dictionary}
          context={context}
        />
        <p className="text-muted-foreground text-xs">{fields.menu_hint}</p>
      </div>
    );
  }

  const value = data.footer_group.footer;
  const set = (patch: Partial<FooterSettings>) =>
    onChange({ ...data, footer_group: { ...data.footer_group, footer: { ...value, ...patch } } });
  return (
    <div className="flex flex-col gap-5">
      <SwitchField
        id="footer-newsletter"
        label={fields.show_newsletter}
        checked={value.show_newsletter}
        onChange={(show_newsletter) => set({ show_newsletter })}
        context={context}
      />
      {value.show_newsletter && (
        <>
          <LocalizedField
            id="footer-newsletter-heading"
            label={fields.newsletter_heading}
            value={value.newsletter_heading}
            onChange={(newsletter_heading) => set({ newsletter_heading })}
            context={context}
          />
          <LocalizedField
            id="footer-newsletter-body"
            label={fields.newsletter_body}
            value={value.newsletter_body}
            onChange={(newsletter_body) => set({ newsletter_body })}
            multiline
            context={context}
          />
        </>
      )}
      <SwitchField
        id="footer-socials"
        label={fields.show_socials}
        description={fields.show_socials_hint}
        checked={value.show_socials}
        onChange={(show_socials) => set({ show_socials })}
        context={context}
      />
      <LocalizedField
        id="footer-copyright"
        label={fields.copyright}
        description={fields.copyright_hint}
        value={value.copyright}
        onChange={(copyright) => set({ copyright })}
        context={context}
      />
      <ColorSchemeField
        id="footer-scheme"
        value={value.color_scheme}
        onChange={(color_scheme) => set({ color_scheme })}
        dictionary={dictionary}
        context={context}
      />
      <p className="text-muted-foreground text-xs">{fields.footer_links_hint}</p>
    </div>
  );
}
