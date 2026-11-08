import { LanguageSelect } from "./components/language-select";
import { getAdminLocale } from "@repo/core/lib/admin-locale";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { languageOptions } from "@repo/core/lib/locale/language-options";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

// Staff sign-in: no storefront header, just the store name above the form and a language picker.
export default async function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await getAdminLocale();
  const [site_name, dictionary] = await Promise.all([getSiteSetting("SITE_NAME"), getAdminDictionary(lang)]);

  return (
    <main className="bg-muted/40 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <p className="text-lg font-semibold tracking-tight">{site_name}</p>
      <div className="bg-background w-full max-w-sm rounded-xl border p-6 shadow-sm">{children}</div>
      <LanguageSelect lang={lang} label={dictionary.admin_shell.language} options={languageOptions()} />
    </main>
  );
}
