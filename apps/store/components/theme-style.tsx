import type { ThemeSettings } from "@repo/core/lib/schemas/theme";
import { themeCss } from "@repo/core/themes/css";

// The theme's design tokens. Rendered by each storefront layout (and the theme preview), not the
// root layout, so the preview can show a draft without the live theme's rules underneath.
export function ThemeStyle({ settings }: { settings: ThemeSettings }) {
  // Values are validated hex colours and enums; escaping "<" keeps the tag closed regardless.
  return <style dangerouslySetInnerHTML={{ __html: themeCss(settings).replaceAll("<", "\\3c ") }} />;
}
