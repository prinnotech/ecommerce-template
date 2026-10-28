import { AccountNav } from "./components/account-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";

// Server-side guard: every /account page requires a signed-in customer.
export default async function AccountLayout({ children, params }: LayoutProps<"/[lang]/account">) {
  const { lang } = await params;
  const user = await requireUser(lang, `/${lang}/account`);
  const dictionary = await getDictionary(lang);

  return (
    <>
      <SiteHeader lang={lang} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{dictionary.account.title}</h1>
          <p className="text-muted-foreground text-sm">
            {dictionary.account.greeting.replace("{name}", user.name || user.email)}
          </p>
        </div>
        <AccountNav lang={lang} dictionary={dictionary.account.nav} errors={dictionary.errors} />
        <main className="flex-1">{children}</main>
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}
