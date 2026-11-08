"use client";

import { ArrowLeftIcon, HistoryIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { EditorContext } from "./editor-fields";
import { NavigationPanel, type LinkSuggestion } from "./navigation-panel";
import { PreviewFrame } from "./preview-frame";
import type { CategoryOption, CollectionOption } from "./section-form";
import { SectionsPanel } from "./sections-panel";
import { ThemeSettingsForm } from "./theme-settings-form";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { ThemeEditorData } from "@repo/core/actions/themes";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { useNavigation } from "@repo/core/hooks/use-navigation";
import { useSavePageSections } from "@repo/core/hooks/use-pages";
import {
  useDiscardThemeDraft,
  usePublishTheme,
  useRestoreThemeVersion,
  useSaveThemeDraft,
  useTheme,
} from "@repo/core/hooks/use-themes";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import {
  page_sections_schema,
  THEME_PAGES,
  theme_data_schema,
  type ThemeData,
  type ThemePage,
  type ThemeSection,
} from "@repo/core/lib/schemas/theme";
import { formatDateTime } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";

const AUTOSAVE_MS = 700;

export type CustomPageOption = { id: string; title: string; sections: ThemeSection[] };
// A theme page, or "page:<id>" for a custom page (Online store → Pages).
type EditorPage = ThemePage | `page:${string}`;

function toEditorPage(value: string, custom_pages: CustomPageOption[]): EditorPage {
  const theme_page = THEME_PAGES.find((item) => item === value);
  if (theme_page) return theme_page;
  const id = value.startsWith("page:") ? value.slice(5) : "";
  return custom_pages.some((item) => item.id === id) ? `page:${id}` : "home";
}

type ThemeEditorProps = {
  id: string;
  lang: string;
  can_edit: boolean;
  can_edit_pages: boolean;
  initial_page: string;
  custom_pages: CustomPageOption[];
  categories: CategoryOption[];
  collections: CollectionOption[];
  link_suggestions: LinkSuggestion[];
  dictionary: AdminDictionary["themes"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

// Loads the theme, then the workspace. After "Restore" or "Discard" the server's draft replaces
// the editor's, so the workspace is mounted again from the reloaded data.
export function ThemeEditor(props: ThemeEditorProps) {
  const theme = useTheme(props.id);
  const [generation, setGeneration] = useState(0);

  if (theme.isPending) {
    return (
      <div className="flex h-svh">
        <Skeleton className="m-4 w-80 rounded-xl" />
        <Skeleton className="m-4 flex-1 rounded-xl" />
      </div>
    );
  }
  if (theme.isError) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-destructive text-sm">{errorText(props.errors, theme.error)}</p>
        <Button asChild variant="outline">
          <Link href="/themes">{props.dictionary.editor.back}</Link>
        </Button>
      </div>
    );
  }
  return (
    <Workspace key={generation} {...props} data={theme.data} onReloaded={() => setGeneration((value) => value + 1)} />
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";
type PendingConfirm = { kind: "discard" } | { kind: "restore"; published_at: string };

function Workspace({
  id,
  lang,
  can_edit,
  can_edit_pages,
  initial_page,
  custom_pages,
  categories,
  collections,
  link_suggestions,
  dictionary,
  common,
  errors,
  validation,
  data,
  onReloaded,
}: ThemeEditorProps & { data: ThemeEditorData; onReloaded: () => void }) {
  const text = dictionary.editor;
  const save = useSaveThemeDraft();
  const navigation = useNavigation();
  const publish = usePublishTheme();
  const discard = useDiscardThemeDraft();
  const restore = useRestoreThemeVersion();
  const [draft, setDraft] = useState<ThemeData>(data.draft);
  const [save_state, setSaveState] = useState<SaveState>("idle");
  const [has_local_changes, setHasLocalChanges] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [preview_lang, setPreviewLang] = useState<Locale>(LOCALES.find((locale) => locale === lang) ?? LOCALES[0]);
  const [refresh_count, setRefreshCount] = useState(0);
  const [page, setPage] = useState<EditorPage>(() => toEditorPage(initial_page, custom_pages));
  const custom_page = page.startsWith("page:") ? custom_pages.find((item) => `page:${item.id}` === page) : undefined;
  const theme_page: ThemePage = THEME_PAGES.find((item) => item === page) ?? "home";
  // Custom pages are saved straight to the page (no draft); the editor keeps the latest copy.
  const save_page = useSavePageSections();
  const [custom_sections, setCustomSections] = useState<Record<string, ThemeSection[]>>({});
  const page_timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [is_confirm_open, setIsConfirmOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);

  const context: EditorContext = { lang, is_disabled: !can_edit, common, errors, media: text.media };
  const onError = (error: unknown) => toast.error(errorText(errors, error));
  const has_unpublished = data.has_unpublished_changes || has_local_changes;

  // Leaving with a save still waiting would lose the last few keystrokes.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (timer.current || page_timer.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function saveNow(next: ThemeData): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // A half-typed link or colour isn't valid yet: keep it in the editor, save once it is.
    const parsed = theme_data_schema.safeParse(next);
    if (!parsed.success) {
      setSaveState("error");
      return false;
    }
    setSaveState("saving");
    try {
      await save.mutateAsync({ id, data: parsed.data });
      // Only the newest edit marks the editor as saved.
      if (latest.current === next) setSaveState("saved");
      setRefreshCount((value) => value + 1);
      return true;
    } catch (error) {
      setSaveState("error");
      onError(error);
      return false;
    }
  }

  function change(next: ThemeData) {
    if (!can_edit) return;
    setDraft(next);
    latest.current = next;
    setHasLocalChanges(true);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(next), AUTOSAVE_MS);
  }

  function changeCustomPage(page_id: string, sections: ThemeSection[]) {
    if (!can_edit_pages) return;
    setCustomSections((current) => ({ ...current, [page_id]: sections }));
    if (page_timer.current) clearTimeout(page_timer.current);
    const parsed = page_sections_schema.safeParse(sections);
    if (!parsed.success) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    page_timer.current = setTimeout(() => {
      page_timer.current = null;
      save_page.mutate(
        { id: page_id, sections: parsed.data },
        {
          onSuccess: () => {
            setSaveState("saved");
            setRefreshCount((value) => value + 1);
          },
          onError: (error) => {
            setSaveState("error");
            onError(error);
          },
        },
      );
    }, AUTOSAVE_MS);
  }

  async function onPublish() {
    // The last edit may still be waiting for its autosave.
    if (timer.current && !(await saveNow(latest.current))) return;
    publish.mutate(id, {
      onSuccess: (result) => {
        setHasLocalChanges(false);
        toast.success(
          (result.is_store_refreshed ? dictionary.published : dictionary.published_slow).replace("{name}", data.name),
        );
      },
      onError,
    });
  }

  function onConfirm() {
    if (!confirm) return;
    const done = (message: string) => () => {
      toast.success(message);
      setIsConfirmOpen(false);
      onReloaded();
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (confirm.kind === "discard") {
      discard.mutate(id, { onSuccess: done(text.discarded), onError });
    } else {
      restore.mutate({ id, published_at: confirm.published_at }, { onSuccess: done(text.restored), onError });
    }
  }

  function openConfirm(next: PendingConfirm) {
    setConfirm(next);
    setIsConfirmOpen(true);
  }

  const save_label =
    save_state === "saving"
      ? text.saving
      : save_state === "error"
        ? text.save_failed
        : save_state === "saved"
          ? text.saved
          : "";

  return (
    <div className="flex h-svh flex-col">
      <header className="bg-background flex h-14 shrink-0 items-center gap-3 border-b px-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/themes">
            <ArrowLeftIcon />
            {text.back}
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-semibold">{data.name}</span>
          {data.is_live && <StatusBadge tone="success">{dictionary.live}</StatusBadge>}
          {!can_edit && <StatusBadge tone="neutral">{text.read_only}</StatusBadge>}
          {save_label && (
            <span
              role="status"
              className={cn("text-xs", save_state === "error" ? "text-destructive" : "text-muted-foreground")}
            >
              {save_label}
            </span>
          )}
        </div>
        <div className="hidden items-center gap-1 rounded-md border p-0.5 md:flex">
          <Button
            type="button"
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={text.device_desktop}
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <MonitorIcon />
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={text.device_mobile}
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <SmartphoneIcon />
          </Button>
        </div>
        <label className="sr-only" htmlFor="preview-lang">
          {text.preview_language}
        </label>
        <NativeSelect
          id="preview-lang"
          size="sm"
          value={preview_lang}
          onChange={(event) => setPreviewLang(LOCALES.find((locale) => locale === event.target.value) ?? LOCALES[0])}
          className="hidden uppercase md:block"
        >
          {LOCALES.map((locale) => (
            <NativeSelectOption key={locale} value={locale}>
              {locale}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" aria-label={text.history}>
              <HistoryIcon />
              <span className="hidden lg:inline">{text.history}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              {data.history.length > 0 ? text.history_hint : text.history_empty}
            </DropdownMenuLabel>
            {data.history.length > 0 && <DropdownMenuSeparator />}
            {data.history.map((version) => (
              <DropdownMenuItem
                key={version.published_at}
                disabled={!can_edit}
                onSelect={() => openConfirm({ kind: "restore", published_at: version.published_at })}
              >
                <span className="flex-1">{formatDateTime(version.published_at, lang)}</span>
                <span className="text-muted-foreground text-xs">{text.restore}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {can_edit && data.is_published && has_unpublished && (
          <Button type="button" variant="outline" size="sm" onClick={() => openConfirm({ kind: "discard" })}>
            {text.discard}
          </Button>
        )}
        {can_edit && (
          <Button type="button" size="sm" disabled={publish.isPending} onClick={() => void onPublish()}>
            {publish.isPending && <Spinner />}
            {dictionary.publish}
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-full shrink-0 flex-col border-r md:w-80 lg:w-96">
          <Tabs defaultValue="sections" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="mx-3 mt-3 grid grid-cols-3">
              <TabsTrigger value="sections">{text.tab_sections}</TabsTrigger>
              <TabsTrigger value="settings">{text.tab_settings}</TabsTrigger>
              <TabsTrigger value="navigation">{text.tab_navigation}</TabsTrigger>
            </TabsList>
            <TabsContent value="sections" className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <label htmlFor="editor-page" className="sr-only">
                  {text.page_label}
                </label>
                <NativeSelect
                  id="editor-page"
                  value={page}
                  className="w-full"
                  onChange={(event) => setPage(toEditorPage(event.target.value, custom_pages))}
                >
                  <optgroup label={text.theme_pages}>
                    {THEME_PAGES.map((item) => (
                      <NativeSelectOption key={item} value={item}>
                        {text.pages[item]}
                      </NativeSelectOption>
                    ))}
                  </optgroup>
                  {custom_pages.length > 0 && (
                    <optgroup label={text.custom_pages}>
                      {custom_pages.map((item) => (
                        <NativeSelectOption key={item.id} value={`page:${item.id}`}>
                          {item.title}
                        </NativeSelectOption>
                      ))}
                    </optgroup>
                  )}
                </NativeSelect>
              </div>
              {custom_page ? (
                <>
                  <p className="text-muted-foreground mb-4 text-xs">{text.custom_page_hint}</p>
                  <SectionsPanel
                    key={page}
                    kind="custom"
                    title={custom_page.title}
                    sections={custom_sections[custom_page.id] ?? custom_page.sections}
                    onChange={(sections) => changeCustomPage(custom_page.id, sections)}
                    categories={categories}
                    collections={collections}
                    dictionary={text}
                    invalid_label={validation.invalid}
                    context={{ ...context, is_disabled: !can_edit_pages }}
                  />
                </>
              ) : (
                <SectionsPanel
                  key={page}
                  kind={theme_page}
                  title={text.pages[theme_page]}
                  sections={draft.pages[theme_page]}
                  onChange={(sections) => change({ ...draft, pages: { ...draft.pages, [theme_page]: sections } })}
                  categories={categories}
                  collections={collections}
                  dictionary={text}
                  invalid_label={validation.invalid}
                  context={context}
                />
              )}
            </TabsContent>
            <TabsContent value="navigation" className="min-h-0 flex-1 overflow-y-auto p-4">
              {navigation.data ? (
                <NavigationPanel
                  initial={navigation.data}
                  suggestions={link_suggestions}
                  dictionary={text}
                  errors={errors}
                  invalid_label={validation.invalid}
                  context={context}
                  onSaved={() => setRefreshCount((value) => value + 1)}
                />
              ) : (
                <Skeleton className="h-40 rounded-xl" />
              )}
            </TabsContent>
            <TabsContent value="settings" className="min-h-0 flex-1 overflow-y-auto p-4">
              <ThemeSettingsForm
                settings={draft.settings}
                onChange={(settings) => change({ ...draft, settings })}
                dictionary={text.settings}
                context={context}
              />
            </TabsContent>
          </Tabs>
        </aside>
        <main className="bg-muted/40 hidden min-w-0 flex-1 md:flex">
          <PreviewFrame
            store_url={data.store_url}
            token={data.preview_token}
            lang={preview_lang}
            device={device}
            refresh_count={refresh_count}
            page={page}
            dictionary={text}
          />
        </main>
      </div>

      <ConfirmDialog
        is_open={is_confirm_open}
        onOpenChange={setIsConfirmOpen}
        title={confirm?.kind === "restore" ? text.restore : text.discard_title}
        body={confirm?.kind === "restore" ? text.history_hint : text.discard_body}
        confirm_label={confirm?.kind === "restore" ? text.restore : text.discard}
        cancel_label={common.cancel}
        onConfirm={onConfirm}
        is_pending={discard.isPending || restore.isPending}
        is_destructive={confirm?.kind === "discard"}
      />
    </div>
  );
}
