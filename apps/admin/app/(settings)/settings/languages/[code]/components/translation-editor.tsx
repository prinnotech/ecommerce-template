"use client";

import { ContentEditor } from "./content-editor";
import { StoreTextEditor } from "./store-text-editor";
import { Page } from "@repo/admin-ui/components/page";
import type { Locale } from "@repo/core/i18nConfig";
import { CONTENT_KINDS, type ContentKind } from "@repo/core/lib/content-translation";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";

type TranslationEditorProps = {
  locale: Locale;
  // The language content is written in (DEFAULT_LOCALE): its content tabs edit the originals.
  default_locale: Locale;
  language_name: string;
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["languages"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Everything in one language: the store's own text, then its products, categories, collections
// and pages. Each tab saves on its own.
export function TranslationEditor(props: TranslationEditorProps) {
  const { dictionary, language_name } = props;
  const text = dictionary.editor;
  const tab_labels: Record<ContentKind, string> = {
    products: text.tab_products,
    categories: text.tab_categories,
    collections: text.tab_collections,
    pages: text.tab_pages,
  };

  return (
    <Page title={language_name} back={{ href: "/settings/languages", label: text.back }}>
      <Tabs defaultValue="store" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="store">{text.tab_store}</TabsTrigger>
          {CONTENT_KINDS.map((kind) => (
            <TabsTrigger key={kind} value={kind}>
              {tab_labels[kind]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="store">
          <StoreTextEditor
            locale={props.locale}
            language_name={language_name}
            lang={props.lang}
            can_edit={props.can_edit}
            dictionary={text}
            save_bar={props.save_bar}
            errors={props.errors}
          />
        </TabsContent>
        {CONTENT_KINDS.map((kind) => (
          <TabsContent key={kind} value={kind}>
            <ContentEditor
              kind={kind}
              locale={props.locale}
              lang={props.lang}
              can_edit={props.can_edit}
              is_source={props.locale === props.default_locale}
              dictionary={text}
              save_bar={props.save_bar}
              common={props.common}
              errors={props.errors}
            />
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
