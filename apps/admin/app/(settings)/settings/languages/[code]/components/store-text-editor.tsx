"use client";

import { DownloadIcon, SearchIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { SaveBar } from "@repo/admin-ui/components/save-bar";
import type { TextEntry } from "@repo/core/actions/languages";
import { useLanguageTexts, useSaveLanguageTexts, useTranslateLanguageTexts } from "@repo/core/hooks/use-languages";
import { FALLBACK_LOCALE, type Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { flattenText, type FlatText } from "@repo/core/lib/translations";
import { formatNumber } from "@repo/core/lib/utils/format";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

type EditorText = AdminDictionary["languages"]["editor"];

type StoreTextEditorProps = {
  locale: Locale;
  language_name: string;
  lang: string;
  can_edit: boolean;
  dictionary: EditorText;
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  errors: AdminDictionary["errors"];
};

const AI_BATCH = 100;

export function StoreTextEditor(props: StoreTextEditorProps) {
  const texts = useLanguageTexts(props.locale);
  if (texts.isPending) return <Skeleton className="h-96 rounded-xl" />;
  if (texts.isError) return <p className="text-destructive text-sm">{errorText(props.errors, texts.error)}</p>;
  return <TextList {...props} entries={texts.data} />;
}

function TextList({
  locale,
  language_name,
  lang,
  can_edit,
  dictionary,
  save_bar,
  errors,
  entries,
}: StoreTextEditorProps & { entries: TextEntry[] }) {
  const save = useSaveLanguageTexts(locale);
  const translate = useTranslateLanguageTexts(locale);
  const [drafts, setDrafts] = useState<FlatText>({});
  const [ai_keys, setAiKeys] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [is_missing_only, setIsMissingOnly] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);
  const file_input = useRef<HTMLInputElement>(null);
  const is_source = locale === FALLBACK_LOCALE;
  const valueOf = (entry: TextEntry) => drafts[entry.key] ?? entry.value;
  const missing = entries.filter((entry) => !valueOf(entry).trim());
  const needle = query.trim().toLowerCase();
  const visible = entries.filter(
    (entry) =>
      (!is_missing_only || !valueOf(entry).trim()) &&
      (!needle ||
        entry.key.toLowerCase().includes(needle) ||
        entry.source.toLowerCase().includes(needle) ||
        valueOf(entry).toLowerCase().includes(needle)),
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
    const keys = missing.map((entry) => entry.key);
    if (keys.length === 0) return;
    stop.current = false;
    setProgress({ done: 0, total: keys.length });
    let count = 0;
    try {
      for (let start = 0; start < keys.length && !stop.current; start += AI_BATCH) {
        const result = await translate.mutateAsync(keys.slice(start, start + AI_BATCH));
        count += Object.keys(result).length;
        setDrafts((current) => ({ ...current, ...result }));
        setAiKeys((current) => new Set([...current, ...Object.keys(result)]));
        setProgress({ done: Math.min(start + AI_BATCH, keys.length), total: keys.length });
      }
      toast.success(dictionary.ai_done.replace("{count}", formatNumber(count, lang)));
    } catch (error) {
      toast.error(errorText(errors, error));
    } finally {
      setProgress(null);
    }
  }

  function exportJson() {
    const values = Object.fromEntries(entries.map((entry) => [entry.key, valueOf(entry)]).filter(([, text]) => text));
    const blob = new Blob([`${JSON.stringify(values, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `store-text-${locale}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      // Flat ({ "a.b": "…" }) or nested ({ a: { b: "…" } }) files both work.
      const parsed: unknown = JSON.parse(await file.text());
      const flat = flattenText(parsed);
      const nested_keys = Object.entries(flat).filter(([key]) => key.includes("."));
      const known = new Set(entries.map((entry) => entry.key));
      const values = Object.fromEntries(
        (nested_keys.length > 0 ? Object.entries(flat) : Object.entries(parsed as Record<string, unknown>)).filter(
          (pair): pair is [string, string] => typeof pair[1] === "string" && known.has(pair[0]),
        ),
      );
      if (Object.keys(values).length === 0) throw new Error("empty");
      setDrafts((current) => ({ ...current, ...values }));
      toast.success(dictionary.imported.replace("{count}", formatNumber(Object.keys(values).length, lang)));
    } catch {
      // Not JSON, or no known keys.
      toast.error(dictionary.import_invalid);
    }
  }

  function onSave() {
    save.mutate(drafts, {
      onSuccess: () => {
        setDrafts({});
        setAiKeys(new Set());
        toast.success(dictionary.saved);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {is_source && <p className="text-muted-foreground text-sm">{dictionary.english_note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.search}
            aria-label={dictionary.search}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={is_missing_only} onCheckedChange={(checked) => setIsMissingOnly(checked === true)} />
          {dictionary.missing_only}
        </label>
        <Button type="button" variant="outline" size="sm" onClick={exportJson}>
          <DownloadIcon />
          {dictionary.export}
        </Button>
        {can_edit && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => file_input.current?.click()}>
              <UploadIcon />
              {dictionary.import}
            </Button>
            <input
              ref={file_input}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => void importJson(event)}
            />
          </>
        )}
      </div>

      {can_edit && !is_source && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <span className="text-sm">
            {dictionary.count
              .replace("{missing}", formatNumber(missing.length, lang))
              .replace("{total}", formatNumber(entries.length, lang))}
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
            <Button type="button" size="sm" disabled={missing.length === 0} onClick={() => void translateMissing()}>
              <SparklesIcon />
              {dictionary.translate_missing}
            </Button>
          )}
        </div>
      )}

      <div className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
        <div className="text-muted-foreground hidden grid-cols-2 gap-4 px-4 py-2 text-xs font-medium md:grid">
          <span>{dictionary.column_source}</span>
          <span>{language_name}</span>
        </div>
        {visible.map((entry) => {
          const value = valueOf(entry);
          const is_long = entry.source.length > 70 || entry.source.includes("\n");
          const control_id = `text-${entry.key}`;
          return (
            <div key={entry.key} className="grid gap-2 px-4 py-3 md:grid-cols-2 md:gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={control_id} className="text-sm whitespace-pre-line">
                  {entry.source}
                </label>
                <span className="text-muted-foreground truncate font-mono text-[11px]">{entry.key}</span>
              </div>
              <div className="flex flex-col gap-1">
                {is_long ? (
                  <Textarea
                    id={control_id}
                    rows={3}
                    value={value}
                    disabled={!can_edit}
                    onChange={(event) => setText(entry.key, event.target.value)}
                    className={cn(ai_keys.has(entry.key) && "border-info")}
                  />
                ) : (
                  <Input
                    id={control_id}
                    value={value}
                    disabled={!can_edit}
                    onChange={(event) => setText(entry.key, event.target.value)}
                    className={cn(ai_keys.has(entry.key) && "border-info")}
                  />
                )}
                {ai_keys.has(entry.key) && <span className="text-info-foreground text-xs">{dictionary.ai_draft}</span>}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">{dictionary.empty}</p>
        )}
      </div>

      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={save.isPending}
          onSave={onSave}
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
