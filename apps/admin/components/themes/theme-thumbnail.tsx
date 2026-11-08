import type { ThemeSettings } from "@repo/core/lib/schemas/theme";
import { readableOn } from "@repo/core/themes/css";
import { FONTS } from "@repo/core/themes/fonts";
import { cn } from "@repo/ui/lib/utils";

const RADIUS = { none: "0px", small: "3px", medium: "6px", large: "10px" } as const;

// A small drawing of a store in the theme's colours, header layout, radius and card style, so
// templates and themes can be told apart at a glance without loading the store. Colours come
// from the theme's data, so they're inline styles (computed values), not theme tokens.
export function ThemeThumbnail({ settings, className }: { settings: ThemeSettings; className?: string }) {
  const { background, foreground, primary, muted } = settings.colors.light;
  const radius = RADIUS[settings.radius];
  const is_inverted = settings.header.layout === "inverted";
  const is_centered = settings.header.layout === "centered";
  const heading_family = FONTS[settings.fonts.heading].kind === "serif" ? "Georgia, serif" : "system-ui, sans-serif";
  const button_radius = settings.buttons === "pill" ? "999px" : radius;
  const is_outline = settings.buttons === "outline";

  return (
    <div
      aria-hidden
      className={cn("flex aspect-[4/3] flex-col overflow-hidden rounded-md border text-[0px]", className)}
      style={{ backgroundColor: background, color: foreground }}
    >
      {settings.header.show_utility_bar && <div className="h-[4%]" style={{ backgroundColor: muted }} />}
      <div
        className={cn("flex h-[12%] shrink-0 items-center gap-[4%] px-[6%]", is_centered && "justify-center")}
        style={{ backgroundColor: is_inverted ? foreground : background, borderBottom: `1px solid ${muted}` }}
      >
        <div
          className="h-[30%] w-[18%] rounded-[1px]"
          style={{ backgroundColor: is_inverted ? background : foreground }}
        />
        {!is_centered &&
          [0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-[16%] w-[9%] rounded-[1px] opacity-50"
              style={{ backgroundColor: is_inverted ? background : foreground }}
            />
          ))}
      </div>
      <div
        className="flex h-[38%] shrink-0 flex-col items-center justify-center gap-[6%]"
        style={{ backgroundColor: muted }}
      >
        <div
          className="w-[55%] text-center text-[min(1.1vw,11px)] leading-none font-semibold"
          style={{
            fontFamily: heading_family,
            textTransform: settings.is_uppercase_headings ? "uppercase" : undefined,
          }}
        >
          Aa
        </div>
        <div
          className="h-[14%] w-[22%]"
          style={{
            borderRadius: button_radius,
            backgroundColor: is_outline ? "transparent" : primary,
            border: is_outline ? `1px solid ${foreground}` : undefined,
            color: readableOn(primary),
          }}
        />
      </div>
      <div className="grid flex-1 grid-cols-3 gap-[4%] p-[6%]">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex flex-col gap-[8%]"
            style={{
              border:
                settings.product_card === "bold"
                  ? `1.5px solid ${foreground}`
                  : settings.product_card === "framed"
                    ? `1px solid ${muted}`
                    : undefined,
              padding: settings.product_card === "framed" ? "4%" : undefined,
              borderRadius: settings.product_card === "framed" ? radius : undefined,
            }}
          >
            <div
              className="flex-1"
              style={{
                backgroundColor: muted,
                borderRadius: settings.product_card === "plain" || settings.product_card === "framed" ? radius : 0,
              }}
            />
            <div className="h-[8%] w-[70%] rounded-[1px] opacity-60" style={{ backgroundColor: foreground }} />
          </div>
        ))}
      </div>
    </div>
  );
}
