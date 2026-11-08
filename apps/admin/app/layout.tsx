import "@/app/globals.css";

import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@repo/ui/components/ui/sonner";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { QueryProvider } from "@repo/core/providers/query-provider";
import { ThemeProvider } from "@repo/core/providers/theme-provider";

const geist_sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geist_mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display serif kept so shared components using font-display render the same as in the store.
const fraunces = Fraunces({ variable: "--font-serif", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  return buildAdminMetadata();
}

// The admin's root layout. Its language is the staff member's choice (lib/admin-locale.ts).
export default async function AdminRootLayout({ children }: LayoutProps<"/">) {
  const lang = await getAdminLocale();

  const [dictionary, is_maintenance] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("MAINTENANCE_MODE"),
  ]);

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${geist_sans.variable} ${geist_mono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {is_maintenance && (
              <div role="status" className="bg-primary text-primary-foreground px-4 py-2 text-center text-sm">
                {dictionary.maintenance.notice}
              </div>
            )}
            {children}
            <Toaster richColors position="top-center" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
