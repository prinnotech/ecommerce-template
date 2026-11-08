import { ThemeStyle } from "@/components/theme-style";
import { getLiveTheme } from "@repo/core/lib/theme-server";

// The live theme's tokens, for every storefront layout (store pages, account, auth, checkout).
export async function LiveThemeStyle() {
  const theme = await getLiveTheme();
  return <ThemeStyle settings={theme.settings} />;
}
