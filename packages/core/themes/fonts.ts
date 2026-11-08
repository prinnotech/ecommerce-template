// The fonts a theme can pick. The store loads each one with next/font (apps/store/lib/theme-fonts.ts)
// under the CSS variable named here, and the theme CSS points --font-sans / --font-serif at it.
// next/font only downloads the files a page actually uses.
export const FONTS = {
  geist: { label: "Geist", variable: "--font-geist", kind: "sans" },
  inter: { label: "Inter", variable: "--font-inter", kind: "sans" },
  dm_sans: { label: "DM Sans", variable: "--font-dm-sans", kind: "sans" },
  manrope: { label: "Manrope", variable: "--font-manrope", kind: "sans" },
  fraunces: { label: "Fraunces", variable: "--font-fraunces", kind: "serif" },
  playfair: { label: "Playfair Display", variable: "--font-playfair", kind: "serif" },
  cormorant: { label: "Cormorant Garamond", variable: "--font-cormorant", kind: "serif" },
  oswald: { label: "Oswald", variable: "--font-oswald", kind: "display" },
} as const;

export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

const FALLBACK: Record<(typeof FONTS)[FontId]["kind"], string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  display: "ui-sans-serif, system-ui, sans-serif",
};

export function fontStack(id: FontId): string {
  const font = FONTS[id];
  return `var(${font.variable}), ${FALLBACK[font.kind]}`;
}
