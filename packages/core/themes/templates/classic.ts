import type { ThemeTemplate } from "@repo/core/themes/types";
import { defaultPages, defaultSection } from "@repo/core/themes/sections";

// Warm boutique: high-contrast serif, cream and brown, logo in the centre under a contact bar,
// framed product cards.
export const classic: ThemeTemplate = {
  id: "classic",
  name: "Classic",
  data: {
    settings: {
      colors: {
        light: { background: "#fbf8f3", foreground: "#2b2420", primary: "#6b4f3a", muted: "#f1ebe2" },
        dark: { background: "#1c1815", foreground: "#f3ede5", primary: "#c9a27e", muted: "#2a241f" },
      },
      fonts: { heading: "cormorant", body: "manrope" },
      is_uppercase_headings: false,
      radius: "small",
      buttons: "pill",
      header: { layout: "centered", show_utility_bar: true, announcement: {} },
      product_card: "framed",
    },
    pages: defaultPages([
      defaultSection("hero", {}, "hero"),
      defaultSection("trust_badges", {}, "trust"),
      defaultSection("image_with_text", { image_position: "right" }, "story"),
      defaultSection("product_grid", {}, "featured"),
      defaultSection("rich_text", {}, "about"),
      defaultSection("category_tiles", {}, "categories"),
      defaultSection("newsletter", {}, "newsletter"),
    ]),
  },
};
