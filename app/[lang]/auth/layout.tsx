import { SiteHeader } from "@/components/site-header";

export default async function AuthLayout({ children, params }: LayoutProps<"/[lang]/auth">) {
  const { lang } = await params;

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </>
  );
}
