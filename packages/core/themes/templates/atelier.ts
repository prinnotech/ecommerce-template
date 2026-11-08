import type { ThemeTemplate } from "@repo/core/themes/types";
import { defaultPages, defaultSection, SECTION_TEXT } from "@repo/core/themes/sections";

// The store as it looked before themes existed: editorial serif headings, soft neutrals.
export const atelier: ThemeTemplate = {
  id: "atelier",
  name: "Atelier",
  data: {
    settings: {
      colors: {
        light: { background: "#ffffff", foreground: "#0a0a0a", primary: "#171717", muted: "#f5f5f5" },
        dark: { background: "#0a0a0a", foreground: "#fafafa", primary: "#e5e5e5", muted: "#262626" },
      },
      fonts: { heading: "fraunces", body: "geist" },
      is_uppercase_headings: false,
      radius: "medium",
      buttons: "solid",
      header: { layout: "inline", show_utility_bar: false, announcement: {} },
      product_card: "plain",
    },
    pages: defaultPages([
      defaultSection("hero", {}, "hero"),
      defaultSection("trust_badges", {}, "trust"),
      defaultSection("category_tiles", {}, "categories"),
      defaultSection("product_grid", {}, "featured"),
      defaultSection("product_grid", { heading: SECTION_TEXT.new_arrivals, source: "newest" }, "newest"),
    ]),
  },
};
