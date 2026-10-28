import type { Metadata } from "next";

import { ContactForm } from "./components/contact-form";
import { ContactDetails } from "@/components/storefront/contact-details";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { getSiteSettings } from "@/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/contact",
    title: dictionary.contact.meta_title,
    description: dictionary.contact.meta_description,
  });
}

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  const [dictionary, settings] = await Promise.all([getDictionary(lang), getSiteSettings()]);
  const text = dictionary.contact;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <header className="mb-12 flex max-w-2xl flex-col gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{text.eyebrow}</p>
        <h1 className="font-display text-4xl leading-tight font-medium tracking-tight sm:text-6xl">{text.title}</h1>
        <p className="text-muted-foreground text-lg">{text.subtitle}</p>
      </header>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <section className="flex flex-col gap-6" aria-labelledby="contact-form-title">
          <h2 id="contact-form-title" className="text-xl font-semibold">
            {text.form_title}
          </h2>
          <ContactForm
            dictionary={text}
            common={dictionary.common}
            errors={dictionary.errors}
            validation={dictionary.validation}
          />
        </section>
        <aside className="bg-muted/40 flex h-fit flex-col gap-6 rounded-xl border p-6">
          <h2 className="font-medium">{text.details_title}</h2>
          <ContactDetails settings={settings} lang={lang} labels={text} />
        </aside>
      </div>
    </div>
  );
}
