import type { ThemeTemplate } from "@repo/core/themes/types";
import { defaultPages, defaultSection, SECTION_TEXT } from "@repo/core/themes/sections";

// Lots of white, one clean sans-serif, square corners, outlined buttons, logo in the centre.
export const minimal: ThemeTemplate = {
  id: "minimal",
  name: "Minimal",
  data: {
    settings: {
      colors: {
        light: { background: "#ffffff", foreground: "#111111", primary: "#111111", muted: "#f4f4f2" },
        dark: { background: "#111111", foreground: "#f2f2f2", primary: "#f2f2f2", muted: "#1e1e1e" },
      },
      fonts: { heading: "dm_sans", body: "dm_sans" },
      is_uppercase_headings: false,
      radius: "none",
      buttons: "outline",
      header: { layout: "centered", show_utility_bar: false, announcement: {} },
      product_card: "minimal",
    },
    pages: defaultPages([
      defaultSection("hero", { size: "medium", secondary_button: SECTION_TEXT.no_button }, "hero"),
      defaultSection("product_grid", { heading: SECTION_TEXT.new_arrivals, source: "newest" }, "newest"),
      defaultSection("rich_text", {}, "story"),
      defaultSection("category_tiles", { limit: 3 }, "categories"),
      defaultSection("newsletter", {}, "newsletter"),
    ]),
  },
};
