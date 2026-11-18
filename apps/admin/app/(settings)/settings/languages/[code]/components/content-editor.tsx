"use client";

import { SearchIcon, SparklesIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { useContentTranslations, useSaveContentTranslation, useTranslateContent } from "@repo/core/hooks/use-languages";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { ContentKind, TranslatableField } from "@repo/core/lib/content-translation";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { formatNumber } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

type EditorText = AdminDictionary["languages"]["editor"];

type ContentEditorProps = {
  kind: ContentKind;
  locale: Locale;
  lang: string;
  can_edit: boolean;
  is_source: boolean;
  dictionary: EditorText;
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

const AI_BATCH = 60;

// "title" → Title, "seo/description" → SEO description; anything deeper (page sections) shows its
// path's last words, e.g. "Hero · heading".
function fieldLabel(path: string, dictionary: EditorText): string {
  const named: Record<string, string> = {
    title: dictionary.field_title,
    name: dictionary.field_name,
    description: dictionary.field_description,
    "seo/title": dictionary.field_seo_title,
    "seo/description": dictionary.field_seo_description,
  };
  if (named[path]) return named[path];
  return path
    .split("/")
    .filter((segment) => !segment.startsWith("#") && segment !== "settings" && segment !== "sections")
    .map((segment) => segment.replaceAll("_", " "))
    .join(" · ");
}

// Drafts are keyed "<item id>|<field path>".
const draftKey = (id: string, path: string) => `${id}|${path}`;

export function ContentEditor({
  kind,
  locale,
  lang,
  can_edit,
  is_source,
  dictionary,
  save_bar,
  common,
  errors,
}: ContentEditorProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const content = useContentTranslations(locale, kind, page, search);
  const save = useSaveContentTranslation(locale, kind);
  const translate = useTranslateContent(locale, kind);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [ai_keys, setAiKeys] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [is_saving, setIsSaving] = useState(false);
  const stop = useRef(false);
  const items = content.data?.items ?? [];
  const valueOf = (id: string, field: TranslatableField) => drafts[draftKey(id, field.path)] ?? field.value;
  const missing = items.flatMap((item) =>
    item.fields.filter((field) => !valueOf(item.id, field).trim()).map((field) => ({ id: item.id, field })),
  );
  const is_dirty = Object.keys(drafts).length > 0;

  function setText(key: string, text: string) {
    setDrafts((current) => ({ ...current, [key]: text }));
    setAiKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  async function translateMissing() {
    stop.current = false;
    setProgress({ done: 0, total: missing.length });
    let count = 0;
    try {
      for (let start = 0; start < missing.length && !stop.current; start += AI_BATCH) {
        const batch = missing.slice(start, start + AI_BATCH);
        const result = await translate.mutateAsync(
          Object.fromEntries(batch.map(({ id, field }) => [draftKey(id, field.path), field.source])),
        );
        count += Object.keys(result).length;
        setDrafts((current) => ({ ...current, ...result }));
        setAiKeys((current) => new Set([...current, ...Object.keys(result)]));
        setProgress({ done: Math.min(start + AI_BATCH, missing.length), total: missing.length });
      }
      toast.success(dictionary.ai_done.replace("{count}", formatNumber(count, lang)));
    } catch (error) {
      toast.error(errorText(errors, error));
    } finally {
      setProgress(null);
    }
  }

  // One save per changed item (each is its own record).
  async function onSave() {
    const by_item = new Map<string, Record<string, string>>();
    for (const [key, text] of Object.entries(drafts)) {
      const [id = "", path = ""] = key.split("|");
      by_item.set(id, { ...(by_item.get(id) ?? {}), [path]: text });
    }
    setIsSaving(true);
    try {
      for (const [id, fields] of by_item) await save.mutateAsync({ id, fields });
      setDrafts({});
      setAiKeys(new Set());
      toast.success(dictionary.saved);
    } catch (error) {
      toast.error(errorText(errors, error));
    } finally {
      setIsSaving(false);
    }
  }

  if (content.isError) return <p className="text-destructive text-sm">{errorText(errors, content.error)}</p>;

  return (
    <div className="flex flex-col gap-4">
      {kind === "products" && (
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(query.trim());
          }}
        >
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.search}
            aria-label={dictionary.search}
            className="pl-9"
          />
        </form>
      )}

      {can_edit && !is_source && items.length > 0 && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <span className="text-sm">
            {dictionary.count.replace("{missing}", formatNumber(missing.length, lang)).replace(
              "{total}",
              formatNumber(
                items.reduce((sum, item) => sum + item.fields.length, 0),
                lang,
              ),
            )}
          </span>
          {progress ? (
            <div className="flex items-center gap-3">
              <Spinner />
              <span className="text-sm">
                {dictionary.translating
                  .replace("{done}", formatNumber(progress.done, lang))
                  .replace("{total}", formatNumber(progress.total, lang))}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => (stop.current = true)}>
                {dictionary.stop}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={missing.length === 0 || is_dirty}
              onClick={() => void translateMissing()}
            >
              <SparklesIcon />
              {dictionary.translate_missing}
            </Button>
          )}
        </div>
      )}

      {content.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{dictionary.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
              <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{item.label}</h3>
              <div className="divide-y">
                {item.fields.map((field) => {
                  const key = draftKey(item.id, field.path);
                  const control_id = `content-${key}`;
                  const value = valueOf(item.id, field);
                  const is_long = field.source.length > 80 || field.source.includes("\n");
                  return (
                    <div key={key} className="grid gap-2 px-4 py-3 md:grid-cols-2 md:gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-muted-foreground text-xs capitalize">
                          {fieldLabel(field.path, dictionary)}
                        </span>
                        <label htmlFor={control_id} className="line-clamp-4 text-sm whitespace-pre-line">
                          {field.source}
                        </label>
                      </div>
                      <div className="flex flex-col gap-1">
                        {is_long ? (
                          <Textarea
                            id={control_id}
                            rows={4}
                            value={value}
                            disabled={!can_edit}
                            onChange={(event) => setText(key, event.target.value)}
                            className={cn(ai_keys.has(key) && "border-info")}
                          />
                        ) : (
                          <Input
                            id={control_id}
                            value={value}
                            disabled={!can_edit}
                            onChange={(event) => setText(key, event.target.value)}
                            className={cn(ai_keys.has(key) && "border-info")}
                          />
                        )}
                        {ai_keys.has(key) && (
                          <span className="text-info-foreground text-xs">{dictionary.ai_draft}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(content.data?.total_pages ?? 1) > 1 && (
        <nav className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || is_dirty}
            onClick={() => setPage((value) => value - 1)}
          >
            {common.previous}
          </Button>
          <span className="text-muted-foreground text-sm">
            {formatNumber(page, lang)} / {formatNumber(content.data?.total_pages ?? 1, lang)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= (content.data?.total_pages ?? 1) || is_dirty}
            onClick={() => setPage((value) => value + 1)}
          >
            {common.next}
          </Button>
        </nav>
      )}

      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={is_saving}
          onSave={() => void onSave()}
          onDiscard={() => {
            setDrafts({});
            setAiKeys(new Set());
          }}
          dictionary={save_bar}
        />
      )}
    </div>
  );
}
