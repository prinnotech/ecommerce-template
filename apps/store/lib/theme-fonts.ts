import {
  Cormorant_Garamond,
  DM_Sans,
  Fraunces,
  Geist,
  Geist_Mono,
  Inter,
  Manrope,
  Oswald,
  Playfair_Display,
} from "next/font/google";

// Every font a theme can pick, each under the CSS variable listed in packages/core/themes/fonts.ts
// (next/font only accepts literal options, so the names are repeated here). The theme CSS points
// --font-sans / --font-serif at two of them; the browser only downloads the files a page uses.
// Only the default theme's fonts are preloaded.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
const dm_sans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], preload: false });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], preload: false });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], preload: false });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], preload: false });
const geist_mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const THEME_FONT_CLASSES = [geist, fraunces, inter, dm_sans, manrope, playfair, cormorant, oswald, geist_mono]
  .map((font) => font.variable)
  .join(" ");
