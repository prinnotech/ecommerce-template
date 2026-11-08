import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { requireCaller } from "@repo/core/lib/auth";

// Full-screen tools (the theme editor) without the admin sidebar. Same guard as the admin layout:
// active staff only; each page checks its own permission too.
export default async function EditorLayout({ children }: LayoutProps<"/">) {
  await requireCaller();
  return <TooltipProvider>{children}</TooltipProvider>;
}
