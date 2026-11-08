"use client";

import { TriangleAlertIcon } from "lucide-react";

import { ColorField, LocalizedField, SelectField, SwitchField, type EditorContext } from "./editor-fields";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  BUTTON_STYLES,
  CARD_STYLES,
  HEADER_LAYOUTS,
  RADII,
  type Palette,
  type ThemeSettings,
} from "@repo/core/lib/schemas/theme";
import { contrastRatio } from "@repo/core/themes/css";
import { FONT_IDS, FONTS } from "@repo/core/themes/fonts";
import { formatNumber } from "@repo/core/lib/utils/format";

type SettingsDictionary = AdminDictionary["themes"]["editor"]["settings"];

const MIN_CONTRAST = 4.5;
const PALETTE_KEYS = ["background", "foreground", "primary", "muted"] as const satisfies readonly (keyof Palette)[];

type ThemeSettingsFormProps = {
  settings: ThemeSettings;
  onChange: (settings: ThemeSettings) => void;
  dictionary: SettingsDictionary;
  context: EditorContext;
};

export function ThemeSettingsForm({ settings, onChange, dictionary, context }: ThemeSettingsFormProps) {
  const set = (patch: Partial<ThemeSettings>) => onChange({ ...settings, ...patch });
  const font_options = FONT_IDS.map((font) => ({ value: font, label: FONTS[font].label }));

  function palette(mode: "light" | "dark") {
    const colors = settings.colors[mode];
    const ratio = contrastRatio(colors.foreground, colors.background);
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-muted-foreground pb-1 text-xs font-medium tracking-wide uppercase">
          {dictionary[mode]}
        </legend>
        {PALETTE_KEYS.map((key) => (
          <ColorField
            key={key}
            id={`color-${mode}-${key}`}
            label={dictionary[`color_${key}`]}
            value={colors[key]}
            onChange={(value) => set({ colors: { ...settings.colors, [mode]: { ...colors, [key]: value } } })}
            context={context}
          />
        ))}
        {ratio < MIN_CONTRAST && (
          <p role="status" className="text-warning-foreground bg-warning flex gap-2 rounded-md px-3 py-2 text-xs">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {dictionary.contrast_warning.replace(
              "{ratio}",
              formatNumber(ratio, context.lang, { maximumFractionDigits: 1 }),
            )}
          </p>
        )}
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{dictionary.colors}</h3>
        {palette("light")}
        {palette("dark")}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{dictionary.typography}</h3>
        <SelectField
          id="font-heading"
          label={dictionary.heading_font}
          value={settings.fonts.heading}
          options={font_options}
          onChange={(heading) => set({ fonts: { ...settings.fonts, heading } })}
          context={context}
        />
        <SelectField
          id="font-body"
          label={dictionary.body_font}
          value={settings.fonts.body}
          options={font_options}
          onChange={(body) => set({ fonts: { ...settings.fonts, body } })}
          context={context}
        />
        <SwitchField
          id="uppercase-headings"
          label={dictionary.uppercase}
          checked={settings.is_uppercase_headings}
          onChange={(is_uppercase_headings) => set({ is_uppercase_headings })}
          context={context}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{dictionary.shape}</h3>
        <SelectField
          id="radius"
          label={dictionary.radius}
          value={settings.radius}
          options={RADII.map((radius) => ({ value: radius, label: dictionary[`radius_${radius}`] }))}
          onChange={(radius) => set({ radius })}
          context={context}
        />
        <SelectField
          id="buttons"
          label={dictionary.buttons}
          value={settings.buttons}
          options={BUTTON_STYLES.map((style) => ({ value: style, label: dictionary[`buttons_${style}`] }))}
          onChange={(buttons) => set({ buttons })}
          context={context}
        />
        <SelectField
          id="product-card"
          label={dictionary.product_card}
          value={settings.product_card}
          options={CARD_STYLES.map((style) => ({ value: style, label: dictionary[`card_${style}`] }))}
          onChange={(product_card) => set({ product_card })}
          context={context}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{dictionary.header}</h3>
        <SelectField
          id="header-layout"
          label={dictionary.header_layout}
          value={settings.header.layout}
          options={HEADER_LAYOUTS.map((layout) => ({ value: layout, label: dictionary[`layout_${layout}`] }))}
          onChange={(layout) => set({ header: { ...settings.header, layout } })}
          context={context}
        />
        <SwitchField
          id="utility-bar"
          label={dictionary.utility_bar}
          description={dictionary.utility_bar_hint}
          checked={settings.header.show_utility_bar}
          onChange={(show_utility_bar) => set({ header: { ...settings.header, show_utility_bar } })}
          context={context}
        />
        <LocalizedField
          id="announcement"
          label={dictionary.announcement}
          description={dictionary.announcement_hint}
          value={settings.header.announcement}
          onChange={(announcement) => set({ header: { ...settings.header, announcement } })}
          context={context}
        />
        <p className="text-muted-foreground text-xs">{dictionary.logo_hint}</p>
      </section>
    </div>
  );
}
