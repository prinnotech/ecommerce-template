"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { LocalizedField, SwitchField, TextInputField, type EditorContext } from "./editor-fields";
import { ItemList } from "./item-list";
import { useSaveNavigation } from "@repo/core/hooks/use-navigation";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  MAX_FOOTER_COLUMNS,
  MAX_MENU_ITEMS,
  navigation_schema,
  type MenuLink,
  type Navigation,
} from "@repo/core/lib/schemas/navigation";
import { newSectionId } from "@repo/core/themes/sections";

const AUTOSAVE_MS = 700;

export type LinkSuggestion = { href: string; label: string };

type NavigationPanelProps = {
  initial: Navigation;
  suggestions: LinkSuggestion[];
  dictionary: AdminDictionary["themes"]["editor"];
  errors: AdminDictionary["errors"];
  invalid_label: string;
  context: EditorContext;
  // After each save, so the preview reloads the store's header and footer.
  onSaved: () => void;
};

// Header menu and footer. Not part of the theme: saving makes them live at once.
export function NavigationPanel({
  initial,
  suggestions,
  dictionary,
  errors,
  invalid_label,
  context,
  onSaved,
}: NavigationPanelProps) {
  const text = dictionary.navigation;
  const save = useSaveNavigation();
  const [navigation, setNavigation] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list_id = "navigation-links";
  const list_labels = {
    remove: text.remove_link,
    move_up: dictionary.move_up,
    move_down: dictionary.move_down,
  };

  function change(next: Navigation) {
    if (context.is_disabled) return;
    setNavigation(next);
    if (timer.current) clearTimeout(timer.current);
    const parsed = navigation_schema.safeParse(next);
    // A half-typed link isn't valid yet: keep it here, save once it is.
    if (!parsed.success) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    timer.current = setTimeout(() => {
      timer.current = null;
      save.mutate(parsed.data, {
        onSuccess: () => {
          setStatus("saved");
          onSaved();
        },
        onError: (error) => {
          setStatus("error");
          toast.error(errorText(errors, error));
        },
      });
    }, AUTOSAVE_MS);
  }

  const newLink = (): MenuLink => ({ id: newSectionId(), label: {}, href: "" });

  function linkFields(link: MenuLink, set_link: (link: MenuLink) => void) {
    return (
      <>
        <LocalizedField
          id={`nav-label-${link.id}`}
          label={text.link_label}
          value={link.label}
          onChange={(label) => set_link({ ...link, label })}
          context={context}
        />
        <TextInputField
          id={`nav-href-${link.id}`}
          label={text.link_href}
          value={link.href}
          onChange={(href) => set_link({ ...link, href })}
          description={text.link_hint}
          is_url
          invalid_label={invalid_label}
          list={list_id}
          context={context}
        />
      </>
    );
  }

  const status_label =
    status === "saving"
      ? dictionary.saving
      : status === "error"
        ? dictionary.save_failed
        : status === "saved"
          ? dictionary.saved
          : "";
  const { footer } = navigation;

  return (
    <div className="flex flex-col gap-8">
      <datalist id={list_id}>
        {suggestions.map((suggestion) => (
          <option key={suggestion.href} value={suggestion.href}>
            {suggestion.label}
          </option>
        ))}
      </datalist>
      <p className="text-muted-foreground text-xs">
        {text.live_hint}
        {status_label && <span className="text-foreground ml-1 font-medium">· {status_label}</span>}
      </p>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{text.header_menu}</h3>
        {navigation.header.length === 0 && <p className="text-muted-foreground text-xs">{text.header_automatic}</p>}
        <ItemList
          label={text.menu_items}
          items={navigation.header}
          max={MAX_MENU_ITEMS}
          onChange={(header) => change({ ...navigation, header })}
          create={() => ({ ...newLink(), children: [] })}
          labels={{ ...list_labels, add: text.add_link }}
          is_disabled={context.is_disabled}
          renderItem={(item, set_item) => (
            <>
              {linkFields(item, (link) => set_item({ ...item, ...link }))}
              <ItemList
                label={text.submenu}
                items={item.children}
                max={MAX_MENU_ITEMS}
                onChange={(children) => set_item({ ...item, children })}
                create={newLink}
                labels={{ ...list_labels, add: text.add_sublink }}
                is_disabled={context.is_disabled}
                renderItem={(child, set_child) => linkFields(child, set_child)}
              />
            </>
          )}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{text.footer}</h3>
        <LocalizedField
          id="footer-about"
          label={text.footer_about}
          description={text.footer_about_hint}
          value={footer.about_text}
          onChange={(about_text) => change({ ...navigation, footer: { ...footer, about_text } })}
          multiline
          context={context}
        />
        {footer.columns.length === 0 && <p className="text-muted-foreground text-xs">{text.footer_automatic}</p>}
        <ItemList
          label={text.footer_columns}
          items={footer.columns}
          max={MAX_FOOTER_COLUMNS}
          onChange={(columns) => change({ ...navigation, footer: { ...footer, columns } })}
          create={() => ({ id: newSectionId(), title: {}, links: [] })}
          labels={{ ...list_labels, add: text.add_column }}
          is_disabled={context.is_disabled}
          renderItem={(column, set_column) => (
            <>
              <LocalizedField
                id={`footer-title-${column.id}`}
                label={text.column_title}
                value={column.title}
                onChange={(title) => set_column({ ...column, title })}
                context={context}
              />
              <ItemList
                label={text.column_links}
                items={column.links}
                max={MAX_MENU_ITEMS}
                onChange={(links) => set_column({ ...column, links })}
                create={newLink}
                labels={{ ...list_labels, add: text.add_link }}
                is_disabled={context.is_disabled}
                renderItem={(link, set_link) => linkFields(link, set_link)}
              />
            </>
          )}
        />
        <SwitchField
          id="footer-contact"
          label={text.show_contact}
          checked={footer.show_contact}
          onChange={(show_contact) => change({ ...navigation, footer: { ...footer, show_contact } })}
          context={context}
        />
        <SwitchField
          id="footer-payments"
          label={text.show_payments}
          checked={footer.show_payments}
          onChange={(show_payments) => change({ ...navigation, footer: { ...footer, show_payments } })}
          context={context}
        />
      </section>
    </div>
  );
}
