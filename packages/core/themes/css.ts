import type { Palette, ThemeSettings } from "@repo/core/lib/schemas/theme";
import { fontStack } from "@repo/core/themes/fonts";

// Theme settings → the CSS that overrides the store's design tokens (packages/ui/styles/globals.css).
// Components keep using bg-primary, text-muted-foreground, rounded-lg…; only the values change.
// Every value comes from the validated schema (hex colours, enums), so the CSS can't be injected.

const RADIUS: Record<ThemeSettings["radius"], string> = {
  none: "0rem",
  small: "0.25rem",
  medium: "0.625rem",
  large: "1rem",
};

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// WCAG contrast ratio (1–21). The editor warns below 4.5 (normal text).
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Text on a coloured button: black or white, whichever reads better.
export function readableOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#000000") ? "#ffffff" : "#000000";
}

function mix(color: string, percent: number, base: string): string {
  return `color-mix(in oklab, ${color} ${percent}%, ${base})`;
}

// Any CSS colour per slot; only `primary` must be hex (its text colour is computed from it).
type PaletteValues = Record<keyof Palette, string>;

function paletteVars(palette: PaletteValues): string {
  const { background, foreground, primary, muted } = palette;
  const on_primary = readableOn(primary);
  const vars: Record<string, string> = {
    "--background": background,
    "--foreground": foreground,
    "--card": background,
    "--card-foreground": foreground,
    "--popover": background,
    "--popover-foreground": foreground,
    "--primary": primary,
    "--primary-foreground": on_primary,
    "--secondary": muted,
    "--secondary-foreground": foreground,
    "--muted": muted,
    "--muted-foreground": mix(foreground, 60, background),
    "--accent": muted,
    "--accent-foreground": foreground,
    "--border": mix(foreground, 12, background),
    "--input": mix(foreground, 16, background),
    "--ring": mix(foreground, 40, background),
  };
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join("");
}

// Dark-on-light swapped (the "inverted" header): text colour as background and the other way round.
function inverted(palette: Palette): PaletteValues {
  return {
    background: palette.foreground,
    foreground: palette.background,
    // A primary close to the text colour would vanish on the swapped background.
    primary: contrastRatio(palette.primary, palette.foreground) < 2 ? palette.background : palette.primary,
    muted: mix(palette.background, 12, palette.foreground),
  };
}

export function themeCss(settings: ThemeSettings): string {
  const { light, dark } = settings.colors;
  const rules = [
    `:root{${paletteVars(light)}--radius:${RADIUS[settings.radius]};--font-sans:${fontStack(settings.fonts.body)};--font-serif:${fontStack(settings.fonts.heading)};}`,
    `.dark{${paletteVars(dark)}}`,
    // A block that uses the swapped colours: bg-background inside it is the theme's text colour.
    `.theme-inverted{${paletteVars(inverted(light))}}`,
    `.dark .theme-inverted{${paletteVars(inverted(dark))}}`,
  ];
  if (settings.is_uppercase_headings) {
    rules.push(".font-display{text-transform:uppercase;letter-spacing:0.02em;}");
  }
  if (settings.buttons === "pill") {
    rules.push("[data-slot=button]{border-radius:9999px;}");
  }
  if (settings.buttons === "outline") {
    // Filled buttons become outlined; buttons drawn on a photo (data-on-image) keep their fill.
    rules.push(
      "[data-slot=button][data-variant=default]:not([data-on-image]){background:transparent;color:var(--foreground);box-shadow:inset 0 0 0 1px var(--foreground);}",
      "[data-slot=button][data-variant=default]:not([data-on-image]):hover{background:var(--foreground);color:var(--background);}",
    );
  }
  return rules.join("\n");
}
