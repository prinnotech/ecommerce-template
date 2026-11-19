import type { Metadata } from "next";

import { UnsubscribeForm } from "./components/unsubscribe-form";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/unsubscribe">): Promise<Metadata> {
  const { lang } = await params;
  const text = (await getDictionary(lang)).unsubscribe;
  return buildPageMetadata({ lang, path: "/unsubscribe", title: text.title, is_private: true });
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// From the link in a marketing email. Unsubscribing takes a click (not just opening the link), so a
// mail scanner that follows links doesn't unsubscribe anyone.
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[lang]/unsubscribe">) {
  const { lang } = await params;
  const query = await searchParams;
  const dictionary = await getDictionary(lang);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-medium tracking-tight">{dictionary.unsubscribe.title}</h1>
      <UnsubscribeForm
        lang={lang}
        user_id={first(query.u)}
        token={first(query.t)}
        dictionary={dictionary.unsubscribe}
        errors={dictionary.errors}
      />
    </div>
  );
}
