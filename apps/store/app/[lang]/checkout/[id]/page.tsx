import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CheckoutForm } from "./components/checkout-form";
import { getCheckout } from "@repo/core/actions/checkout";
import { Button } from "@repo/ui/components/ui/button";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { countryOptions } from "@repo/core/lib/locale/countries";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: `/checkout/${id}`, title: dictionary.checkout.meta_title, is_private: true });
}

export default async function CheckoutPage({ params }: PageProps<"/[lang]/checkout/[id]">) {
  const { lang, id } = await params;
  const [result, dictionary] = await Promise.all([getCheckout(id), getDictionary(lang)]);

  if (!result.ok && result.error === "checkout_expired") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-medium">{dictionary.checkout.expired_title}</h1>
        <p className="text-muted-foreground">{dictionary.checkout.expired_body}</p>
        <Button asChild size="lg">
          <Link href={`/${lang}/cart`}>{dictionary.checkout.back_to_cart}</Link>
        </Button>
      </div>
    );
  }
  if (!result.ok) notFound();
  if (result.data.status === "completed") redirect(`/${lang}/checkout/${id}/thank-you`);

  return (
    <CheckoutForm
      lang={lang}
      checkout={result.data.checkout}
      // Built on the server so the browser's ICU data can't produce a different list.
      countries={countryOptions(lang).map((country) => ({ value: country.code, label: country.name }))}
      dictionary={dictionary.checkout}
      errors={dictionary.errors}
      validation={dictionary.validation}
      loading_label={dictionary.common.loading}
    />
  );
}
