"use client";

import { ArrowLeftIcon, DownloadIcon, FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import type { ImportItemResult, ImportOutcome } from "@/app/actions/catalog-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminCategories, useImportCategories, useImportProducts, useInvalidateCatalog } from "@/hooks/use-catalog";
import { errorText } from "@/lib/action-result";
import {
  parseCategoriesCsv,
  parseProductsCsv,
  templateCsv,
  type ImportKind,
  type ParsedImport,
} from "@/lib/catalog-import";
import type { Dictionary } from "@/lib/i18n";
import {
  IMPORT_CATEGORIES_PER_REQUEST,
  IMPORT_PRODUCTS_PER_REQUEST,
  type ImportCategory,
  type ImportProduct,
} from "@/lib/schemas/catalog-import";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_LISTED_PROBLEMS = 50;
// Without images a request is fast, so send more products per request.
const PRODUCTS_PER_REQUEST_NO_IMAGES = 25;

type Parsed =
  | { kind: "products"; file_name: string; result: ParsedImport<ImportProduct> }
  | { kind: "categories"; file_name: string; result: ParsedImport<ImportCategory> };

type Run = {
  status: "running" | "stopping" | "done" | "stopped" | "error";
  total: number;
  results: ImportItemResult[];
};

type ImportWizardProps = {
  lang: string;
  initial_kind: ImportKind;
  can_edit_categories: boolean;
  dictionary: Dictionary["catalog"]["import"];
  errors: Dictionary["errors"];
};

export function ImportWizard({ lang, initial_kind, can_edit_categories, dictionary, errors }: ImportWizardProps) {
  const [kind, setKind] = useState<ImportKind>(initial_kind);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [is_reading, setIsReading] = useState(false);
  const [update_existing, setUpdateExisting] = useState(true);
  const [download_images, setDownloadImages] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const stop_requested = useRef(false);
  const file_input = useRef<HTMLInputElement>(null);

  const categories = useAdminCategories();
  const import_products = useImportProducts();
  const import_categories = useImportCategories();
  const invalidateCatalog = useInvalidateCatalog();

  const is_running = run?.status === "running" || run?.status === "stopping";

  // Closing the tab mid-import would leave it half done: ask first.
  useEffect(() => {
    if (!is_running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [is_running]);

  function reset(next_kind: ImportKind = kind) {
    setKind(next_kind);
    setParsed(null);
    setRun(null);
    if (file_input.current) file_input.current.value = "";
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv(kind)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(dictionary.file_too_large);
      return;
    }
    setIsReading(true);
    setRun(null);
    try {
      const text = await file.text();
      setParsed(
        kind === "products"
          ? { kind, file_name: file.name, result: parseProductsCsv(text) }
          : { kind, file_name: file.name, result: parseCategoriesCsv(text) },
      );
    } catch {
      toast.error(errors.generic);
    } finally {
      setIsReading(false);
    }
  }

  async function start() {
    if (!parsed || parsed.result.items.length === 0) return;
    stop_requested.current = false;
    const total = parsed.result.items.length;
    setRun({ status: "running", total, results: [] });

    const size =
      parsed.kind === "categories"
        ? IMPORT_CATEGORIES_PER_REQUEST
        : download_images
          ? IMPORT_PRODUCTS_PER_REQUEST
          : PRODUCTS_PER_REQUEST_NO_IMAGES;
    let status: Run["status"] = "done";

    for (let start_index = 0; start_index < total; start_index += size) {
      if (stop_requested.current) {
        status = "stopped";
        break;
      }
      try {
        const results =
          parsed.kind === "categories"
            ? await import_categories.mutateAsync({
                categories: parsed.result.items.slice(start_index, start_index + size),
                update_existing,
              })
            : await importProductChunks(parsed.result.items.slice(start_index, start_index + size));
        setRun((current) => current && { ...current, results: [...current.results, ...results] });
      } catch (error) {
        toast.error(errorText(errors, error));
        status = "error";
        break;
      }
    }

    setRun((current) => current && { ...current, status });
    await invalidateCatalog();
    if (status === "done") toast.success(dictionary.done_title);
  }

  // The server takes IMPORT_PRODUCTS_PER_REQUEST products per call; a bigger chunk is split here.
  async function importProductChunks(items: ImportProduct[]): Promise<ImportItemResult[]> {
    const results: ImportItemResult[] = [];
    for (let index = 0; index < items.length; index += IMPORT_PRODUCTS_PER_REQUEST) {
      const part = items.slice(index, index + IMPORT_PRODUCTS_PER_REQUEST);
      results.push(...(await import_products.mutateAsync({ products: part, update_existing, download_images })));
    }
    return results;
  }

  function stop() {
    stop_requested.current = true;
    setRun((current) => current && { ...current, status: "stopping" });
  }

  const counts = (run?.results ?? []).reduce<Record<ImportOutcome, number>>(
    (totals, result) => ({ ...totals, [result.outcome]: totals[result.outcome] + 1 }),
    { created: 0, updated: 0, skipped: 0, failed: 0 },
  );
  const done_count = run?.results.length ?? 0;
  const percent = run && run.total > 0 ? Math.round((done_count / run.total) * 100) : 0;
  const failed = (run?.results ?? []).filter((result) => result.outcome === "failed");
  const missing_images = (run?.results ?? []).filter((result) => result.reason === "images_failed").length;

  const existing_handles = new Set((categories.data ?? []).map((category) => category.slug));
  const summary = parsed ? summarize(parsed, existing_handles) : null;
  const list_href = `/${lang}/dashboard/${kind === "products" ? "products" : "categories"}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={list_href}
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeftIcon className="size-4" />
          {kind === "products" ? dictionary.back_products : dictionary.back_categories}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.title}</h1>
        <p className="text-muted-foreground text-sm">{dictionary.subtitle}</p>
      </div>

      {can_edit_categories && (
        <Tabs value={kind} onValueChange={(value) => !is_running && reset(value as ImportKind)}>
          <TabsList>
            <TabsTrigger value="products" disabled={is_running}>
              {dictionary.tab_products}
            </TabsTrigger>
            <TabsTrigger value="categories" disabled={is_running}>
              {dictionary.tab_categories}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{dictionary.step_file}</CardTitle>
          <CardDescription>{kind === "products" ? dictionary.file_hint_products : dictionary.file_hint_categories}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label
            className={cn(
              "border-input hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              is_running && "pointer-events-none opacity-60",
            )}
          >
            {is_reading ? <Spinner /> : <FileSpreadsheetIcon className="text-muted-foreground size-8" />}
            <span className="text-sm font-medium">{parsed ? parsed.file_name : dictionary.choose_file}</span>
            <span className="text-muted-foreground text-xs">{dictionary.choose_file_hint}</span>
            <input
              ref={file_input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onFile}
              disabled={is_running}
            />
          </label>
          <Button variant="outline" size="sm" className="w-fit" onClick={downloadTemplate}>
            <DownloadIcon />
            {dictionary.template}
          </Button>
        </CardContent>
      </Card>

      {parsed && summary && (
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.step_review}</CardTitle>
            <CardDescription>{dictionary.rows_read.replace("{count}", String(parsed.result.row_count))}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summary.map((stat) => (
                <div key={stat.label} className="bg-muted/50 rounded-lg p-3">
                  <dt className="text-muted-foreground text-xs">{dictionary.stats[stat.label]}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stat.value.toLocaleString(lang)}</dd>
                </div>
              ))}
            </dl>

            {parsed.result.problems.length > 0 && (
              <div className="border-destructive/40 flex flex-col gap-2 rounded-lg border p-3">
                <p className="text-destructive text-sm font-medium">
                  {dictionary.problems_title.replace("{count}", String(parsed.result.problems.length))}
                </p>
                <ul className="text-muted-foreground max-h-48 overflow-y-auto text-sm">
                  {parsed.result.problems.slice(0, MAX_LISTED_PROBLEMS).map((problem, index) => (
                    <li key={`${problem.line}-${index}`}>
                      {dictionary.line.replace("{line}", String(problem.line))}: {dictionary.problems[problem.message]}
                      {problem.value ? ` (${problem.value})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="import-update">{dictionary.update_existing}</Label>
                  <span className="text-muted-foreground text-xs">{dictionary.update_existing_hint}</span>
                </div>
                <Switch
                  id="import-update"
                  checked={update_existing}
                  onCheckedChange={setUpdateExisting}
                  disabled={is_running}
                />
              </div>
              {parsed.kind === "products" && (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="import-images">{dictionary.download_images}</Label>
                    <span className="text-muted-foreground text-xs">{dictionary.download_images_hint}</span>
                  </div>
                  <Switch
                    id="import-images"
                    checked={download_images}
                    onCheckedChange={setDownloadImages}
                    disabled={is_running}
                  />
                </div>
              )}
            </div>

            {!run || run.status === "error" ? (
              <Button className="w-fit" onClick={start} disabled={parsed.result.items.length === 0}>
                <UploadIcon />
                {(parsed.kind === "products" ? dictionary.start_products : dictionary.start_categories).replace(
                  "{count}",
                  parsed.result.items.length.toLocaleString(lang),
                )}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {run && (
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle>
              {run.status === "done"
                ? dictionary.done_title
                : run.status === "stopped"
                  ? dictionary.stopped_title
                  : run.status === "error"
                    ? dictionary.error_title
                    : dictionary.running_title}
            </CardTitle>
            {is_running && <CardDescription>{dictionary.keep_open}</CardDescription>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="bg-muted h-2 overflow-hidden rounded-full"
              >
                <div className="bg-primary h-full transition-[width]" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-muted-foreground text-sm tabular-nums">
                {dictionary.progress
                  .replace("{done}", done_count.toLocaleString(lang))
                  .replace("{total}", run.total.toLocaleString(lang))}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(counts) as ImportOutcome[]).map((outcome) => (
                <div key={outcome} className="bg-muted/50 rounded-lg p-3">
                  <dt className="text-muted-foreground text-xs">{dictionary.outcomes[outcome]}</dt>
                  <dd className={cn("text-xl font-semibold tabular-nums", outcome === "failed" && counts.failed > 0 && "text-destructive")}>
                    {counts[outcome].toLocaleString(lang)}
                  </dd>
                </div>
              ))}
            </dl>

            {missing_images > 0 && (
              <p className="text-muted-foreground text-sm">
                {dictionary.missing_images.replace("{count}", String(missing_images))}
              </p>
            )}

            {failed.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{dictionary.failed_title}</p>
                <ul className="text-muted-foreground max-h-48 overflow-y-auto text-sm">
                  {failed.slice(0, MAX_LISTED_PROBLEMS).map((result) => (
                    <li key={result.handle}>
                      {result.handle}: {dictionary.reasons[result.reason ?? "generic"]}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {is_running ? (
                <Button variant="outline" onClick={stop} disabled={run.status === "stopping"}>
                  {run.status === "stopping" && <Spinner />}
                  {dictionary.stop}
                </Button>
              ) : (
                <>
                  <Button asChild>
                    <Link href={list_href}>
                      {kind === "products" ? dictionary.view_products : dictionary.view_categories}
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => reset()}>
                    {dictionary.import_another}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type StatKey = keyof Dictionary["catalog"]["import"]["stats"];

function summarize(parsed: Parsed, existing_handles: Set<string>): { label: StatKey; value: number }[] {
  if (parsed.kind === "categories") {
    const items = parsed.result.items;
    return [
      { label: "categories", value: items.length },
      { label: "new_categories", value: items.filter((item) => !existing_handles.has(item.handle)).length },
      { label: "problems", value: parsed.result.problems.length },
    ];
  }
  const items = parsed.result.items;
  const new_categories = new Set(items.map((item) => item.category).filter((handle) => handle && !existing_handles.has(handle)));
  return [
    { label: "products", value: items.length },
    { label: "variants", value: items.reduce((total, item) => total + item.variants.length, 0) },
    { label: "images", value: items.reduce((total, item) => total + item.image_urls.length, 0) },
    { label: "new_categories", value: new_categories.size },
    { label: "problems", value: parsed.result.problems.length },
  ];
}
