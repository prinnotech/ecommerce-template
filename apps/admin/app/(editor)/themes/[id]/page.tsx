import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ThemeEditor } from "./components/theme-editor";
import { getNavigation } from "@repo/core/actions/navigation";
import { getPages } from "@repo/core/actions/pages";
import { getStoreCategories } from "@repo/core/actions/storefront";
import { getTheme, getThemes } from "@repo/core/actions/themes";
import { isLocale, LOCALES } from "@repo/core/i18nConfig";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerCan, callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { localized } from "@repo/core/lib/localized";
import { query_keys } from "@repo/core/lib/query-keys";
import { getCollections } from "@repo/core/actions/collections";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.themes.customize);
}

export default async function ThemeEditorPage({ params, searchParams }: PageProps<"/themes/[id]">) {
  const { id } = await params;
  const { page } = await searchParams;
  const initial_page = typeof page === "string" ? page : "home";
  const caller = await requirePermission("themes.view");
  // /themes/live (from Online store → Pages): the live theme, whatever its id.
  if (id === "live") {
    const themes = await getThemes();
    const live = themes.ok ? themes.data.themes.find((theme) => theme.is_live) : undefined;
    if (!live) notFound();
    redirect(`/themes/${live.id}?page=${encodeURIComponent(initial_page)}`);
  }

  const lang = await getAdminLocale();
  const can_view_pages = callerCan(caller, "pages.view");
  const [dictionary, result, categories, navigation, pages, collections] = await Promise.all([
    getAdminDictionary(lang),
    getTheme({ id }),
    getStoreCategories(),
    getNavigation(),
    can_view_pages ? getPages() : null,
    callerShows(caller, "collections.view") ? getCollections() : null,
  ]);
  if (!result.ok && result.error === "not_found") notFound();
  const query_client = new QueryClient();
  if (result.ok) query_client.setQueryData(query_keys.theme(id), result.data);
  if (navigation.ok) query_client.setQueryData(query_keys.navigation, navigation.data);
  const locale = isLocale(lang) ? lang : LOCALES[0];
  const category_list = categories.ok ? categories.data : [];
  const page_list = pages?.ok ? pages.data : [];
  // Suggestions for menu links: the store's own pages, every category and the custom pages.
  const store_links = dictionary.themes.editor.navigation.store_links;
  const link_suggestions = [
    { href: "/shop", label: store_links.shop },
    { href: "/shop?sort=newest", label: store_links.newest },
    { href: "/about", label: store_links.about },
    { href: "/contact", label: store_links.contact },
    { href: "/account", label: store_links.account },
    { href: "/privacy", label: store_links.privacy },
    { href: "/terms", label: store_links.terms },
    ...category_list.map((category) => ({
      href: `/shop?category=${category.slug}`,
      label: localized(category.name, locale),
    })),
    ...page_list.map((item) => ({ href: `/pages/${item.slug}`, label: localized(item.title, locale) })),
    ...(collections?.ok ? collections.data : []).map((collection) => ({
      href: `/collections/${collection.slug}`,
      label: localized(collection.title, locale),
    })),
  ];

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <ThemeEditor
        id={id}
        lang={lang}
        can_edit={callerShows(caller, "themes.edit") && !caller.is_read_only}
        can_edit_pages={callerCan(caller, "pages.edit") && !caller.is_read_only}
        initial_page={initial_page}
        custom_pages={page_list.map((item) => ({
          id: item.id,
          title: localized(item.title, locale) || item.slug,
          sections: item.sections,
        }))}
        link_suggestions={link_suggestions}
        categories={category_list.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: localized(category.name, locale),
          is_top_level: !category.parent,
        }))}
        collections={(collections?.ok ? collections.data : []).map((collection) => ({
          id: collection.id,
          name: localized(collection.title, locale) || collection.slug,
        }))}
        dictionary={dictionary.themes}
        common={dictionary.common}
        errors={dictionary.errors}
        validation={dictionary.validation}
      />
    </HydrationBoundary>
  );
}
