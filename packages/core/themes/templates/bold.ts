import type { ThemeTemplate } from "@repo/core/themes/types";
import { defaultPages, defaultSection, SECTION_TEXT } from "@repo/core/themes/sections";

// Streetwear: condensed capitals, a strong accent colour, a dark header, square cards with borders.
export const bold: ThemeTemplate = {
  id: "bold",
  name: "Bold",
  data: {
    settings: {
      colors: {
        light: { background: "#ffffff", foreground: "#0b0b0b", primary: "#e0362a", muted: "#f1f1f1" },
        dark: { background: "#0b0b0b", foreground: "#fafafa", primary: "#ff5a3d", muted: "#1c1c1c" },
      },
      fonts: { heading: "oswald", body: "inter" },
      is_uppercase_headings: true,
      radius: "none",
      buttons: "solid",
      header: { layout: "inverted", show_utility_bar: false, announcement: {} },
      product_card: "bold",
    },
    pages: defaultPages([
      defaultSection("hero", { alignment: "left" }, "hero"),
      defaultSection("product_grid", { heading: SECTION_TEXT.new_arrivals, source: "newest" }, "newest"),
      defaultSection("image_with_text", {}, "story"),
      defaultSection("category_tiles", {}, "categories"),
      defaultSection("product_grid", {}, "featured"),
      defaultSection("newsletter", {}, "newsletter"),
    ]),
  },
};
