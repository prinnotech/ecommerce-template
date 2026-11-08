import type { ThemeData } from "@repo/core/lib/schemas/theme";

// A template is code: its look and starting home page. Adding a template = adding a file in
// themes/templates/ and listing it in themes/index.ts; it then shows up in the admin gallery.
// Its description is admin text: themes.templates.<id> in the admin dictionaries.
export type ThemeTemplate = {
  id: string;
  // A product name, the same in every language.
  name: string;
  data: ThemeData;
};
