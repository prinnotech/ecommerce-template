import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Storefront shell. Nothing here reads cookies, so store pages can be static and revalidated.
export default async function StoreLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <>
      <SiteHeader lang={lang} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
