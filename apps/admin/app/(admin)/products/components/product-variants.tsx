"use client";

import { ChevronDownIcon, ChevronRightIcon, PlusIcon, Trash2Icon, WandSparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AdminVariant } from "@repo/core/actions/products";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Button } from "@repo/ui/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import { useSaveVariants } from "@repo/core/hooks/use-catalog";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { save_variants_schema, type VariantInput } from "@repo/core/lib/schemas/catalog";
import { formatPlural } from "@repo/core/lib/utils/format";

type Row = { key: string; variant: VariantInput };
type ColorOption = { key: string; name: string; hex: string };

type ProductVariantsProps = {
  lang: string;
  product_id: string;
  slug: string;
  variants: AdminVariant[];
  can_edit: boolean;
  currency: string;
  dictionary: AdminDictionary["catalog"]["variants"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

function newKey(): string {
  return crypto.randomUUID();
}

function toRow(variant: AdminVariant): Row {
  const { sort_order: _sort_order, ...fields } = variant;
  return { key: variant.id, variant: fields };
}

function makeSku(slug: string, color: string, size: string): string {
  return [slug, color, size]
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function ProductVariants({
  lang,
  product_id,
  slug,
  variants,
  can_edit,
  currency,
  dictionary,
  common,
  errors,
}: ProductVariantsProps) {
  const save_variants = useSaveVariants();
  const [initial] = useState(() => variants.map(toRow));
  const [rows, setRows] = useState<Row[]>(initial);
  const [sizes_text, setSizesText] = useState("");
  const [colors, setColors] = useState<ColorOption[]>([{ key: newKey(), name: "", hex: "#000000" }]);
  const is_dirty = JSON.stringify(rows.map((row) => row.variant)) !== JSON.stringify(initial.map((row) => row.variant));
  const total_stock = rows.reduce((sum, row) => sum + (Number.isFinite(row.variant.stock) ? row.variant.stock : 0), 0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Variants grouped by color (case-insensitive), first-seen order preserved (audit P2).
  const color_groups = new Map<string, { name: string; hex: string; rows: Row[] }>();
  for (const row of rows) {
    const key = row.variant.color.trim().toLowerCase();
    const group = color_groups.get(key) ?? {
      name: row.variant.color.trim(),
      hex: row.variant.color_hex || "#000000",
      rows: [],
    };
    group.rows.push(row);
    color_groups.set(key, group);
  }
  const groups = [...color_groups.values()];

  function toggleGroup(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyToGroup(key: string, patch: Partial<VariantInput>) {
    setRows((current) =>
      current.map((row) =>
        row.variant.color.trim().toLowerCase() === key ? { ...row, variant: { ...row.variant, ...patch } } : row,
      ),
    );
  }

  function updateRow(key: string, patch: Partial<VariantInput>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, variant: { ...row.variant, ...patch } } : row)),
    );
  }

  function newVariant(color: string, color_hex: string, size: string): Row {
    return {
      key: newKey(),
      variant: {
        id: "",
        size,
        color,
        color_hex,
        sku: makeSku(slug, color, size),
        price_override: 0,
        stock: 0,
        is_active: true,
      },
    };
  }

  // Adds every size × color combination that isn't in the table yet.
  function onGenerate() {
    const sizes = sizes_text
      .split(",")
      .map((size) => size.trim())
      .filter(Boolean);
    const named_colors = colors.filter((color) => color.name.trim());
    const color_list = named_colors.length > 0 ? named_colors : [{ key: "", name: "", hex: "" }];
    const size_list = sizes.length > 0 ? sizes : [""];

    const added: Row[] = [];
    for (const color of color_list) {
      for (const size of size_list) {
        const exists = [...rows, ...added].some(
          (row) => same(row.variant.color, color.name) && same(row.variant.size, size),
        );
        if (!exists) added.push(newVariant(color.name.trim(), color.name.trim() ? color.hex : "", size));
      }
    }
    setRows((current) => [...current, ...added]);
    toast.success(formatPlural(added.length, dictionary.generated, lang));
  }

  function onSave() {
    const parsed = save_variants_schema.safeParse({ product_id, variants: rows.map((row) => row.variant) });
    if (!parsed.success) {
      const is_duplicate = parsed.error.issues.some((issue) => issue.message === "duplicate_sku");
      toast.error(is_duplicate ? errors.sku_taken : errors.invalid_input);
      return;
    }
    save_variants.mutate(parsed.data, {
      onSuccess: () => toast.success(dictionary.saved),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {can_edit && (
        <fieldset className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-4">
          <legend className="sr-only">{dictionary.generator_title}</legend>
          <p className="text-sm font-medium">{dictionary.generator_title}</p>
          <Field>
            <FieldLabel htmlFor="variant-sizes">{dictionary.sizes}</FieldLabel>
            <Input
              id="variant-sizes"
              value={sizes_text}
              placeholder="XS, S, M, L, XL"
              aria-describedby="variant-sizes-hint"
              onChange={(event) => setSizesText(event.target.value)}
            />
            <FieldDescription id="variant-sizes-hint">{dictionary.sizes_hint}</FieldDescription>
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{dictionary.colors}</span>
            {colors.map((color, index) => (
              <div key={color.key} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${dictionary.color_value} ${index + 1}`}
                  value={color.hex}
                  onChange={(event) =>
                    setColors((current) =>
                      current.map((item) => (item.key === color.key ? { ...item, hex: event.target.value } : item)),
                    )
                  }
                  className="border-input size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                />
                <Input
                  aria-label={`${dictionary.color_name} ${index + 1}`}
                  placeholder={dictionary.color_name}
                  value={color.name}
                  onChange={(event) =>
                    setColors((current) =>
                      current.map((item) => (item.key === color.key ? { ...item, name: event.target.value } : item)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={dictionary.remove_color}
                  disabled={colors.length <= 1}
                  onClick={() => setColors((current) => current.filter((item) => item.key !== color.key))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setColors((current) => [...current, { key: newKey(), name: "", hex: "#000000" }])}
              >
                <PlusIcon />
                {dictionary.add_color}
              </Button>
              <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onGenerate}>
                <WandSparklesIcon />
                {dictionary.generate}
              </Button>
            </div>
          </div>
        </fieldset>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{dictionary.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const group_key = group.name.trim().toLowerCase();
            const is_collapsed = collapsed.has(group_key);
            return (
              <section key={group_key || "__none"} className="overflow-hidden rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleGroup(group_key)}
                  aria-expanded={!is_collapsed}
                  className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
                >
                  {is_collapsed ? (
                    <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
                  )}
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border"
                    style={{ backgroundColor: group.hex }}
                  />
                  <span className="truncate">{group.name || dictionary.no_color}</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    {formatPlural(group.rows.length, dictionary.sizes_count, lang)}
                  </span>
                </button>
                {!is_collapsed && (
                  <div className="flex flex-col gap-3 border-t p-3">
                    {can_edit && (
                      <div className="flex flex-wrap items-end gap-2">
                        <input
                          type="color"
                          aria-label={dictionary.color_value}
                          value={group.hex}
                          onChange={(event) => applyToGroup(group_key, { color_hex: event.target.value })}
                          className="border-input size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs">{dictionary.columns.color}</span>
                          <Input
                            aria-label={dictionary.columns.color}
                            className="w-64 max-w-full"
                            value={group.name}
                            onChange={(event) => applyToGroup(group_key, { color: event.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs">{dictionary.bulk_price}</span>
                          <MoneyInput
                            lang={lang}
                            id={`bulk-price-${group_key || "none"}`}
                            aria-label={dictionary.bulk_price}
                            cents={Number.NaN}
                            currency={currency}
                            className="w-28"
                            onChange={(cents) => {
                              if (Number.isFinite(cents)) applyToGroup(group_key, { price_override: cents });
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground text-xs">{dictionary.bulk_stock}</span>
                          <Input
                            aria-label={dictionary.bulk_stock}
                            type="number"
                            min={0}
                            className="w-24 tabular-nums"
                            onChange={(event) => {
                              if (Number.isFinite(event.target.valueAsNumber)) {
                                applyToGroup(group_key, { stock: event.target.valueAsNumber });
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="-mx-3 overflow-x-auto px-3">
                      <Table className="min-w-[40rem]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">{dictionary.columns.size}</TableHead>
                            <TableHead className="min-w-56">{dictionary.columns.sku}</TableHead>
                            <TableHead className="w-36">
                              {dictionary.columns.price}
                              <span className="text-muted-foreground block text-xs font-normal">
                                {dictionary.price_hint}
                              </span>
                            </TableHead>
                            <TableHead className="w-24">{dictionary.columns.stock}</TableHead>
                            <TableHead className="w-16">{dictionary.columns.active}</TableHead>
                            <TableHead className="w-10">
                              <span className="sr-only">{dictionary.remove}</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((row, index) => {
                            const label = (column: string) => `${column} ${index + 1}`;
                            return (
                              <TableRow key={row.key}>
                                <TableCell>
                                  <Input
                                    aria-label={label(dictionary.columns.size)}
                                    value={row.variant.size}
                                    disabled={!can_edit}
                                    onChange={(event) => updateRow(row.key, { size: event.target.value })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    aria-label={label(dictionary.columns.sku)}
                                    className="font-mono text-xs"
                                    value={row.variant.sku}
                                    disabled={!can_edit}
                                    onChange={(event) => updateRow(row.key, { sku: event.target.value.toUpperCase() })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <MoneyInput
                                    lang={lang}
                                    id={`variant-price-${row.key}`}
                                    aria-label={label(dictionary.columns.price)}
                                    cents={row.variant.price_override}
                                    currency={currency}
                                    disabled={!can_edit}
                                    invalid={!Number.isFinite(row.variant.price_override)}
                                    onChange={(price_override) => updateRow(row.key, { price_override })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    aria-label={label(dictionary.columns.stock)}
                                    type="number"
                                    min={0}
                                    className="tabular-nums"
                                    value={Number.isFinite(row.variant.stock) ? row.variant.stock : ""}
                                    disabled={!can_edit}
                                    aria-invalid={!Number.isFinite(row.variant.stock) || undefined}
                                    onChange={(event) => updateRow(row.key, { stock: event.target.valueAsNumber })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    aria-label={label(dictionary.columns.active)}
                                    checked={row.variant.is_active}
                                    disabled={!can_edit}
                                    onCheckedChange={(is_active) => updateRow(row.key, { is_active })}
                                  />
                                </TableCell>
                                <TableCell>
                                  {can_edit && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-destructive"
                                      aria-label={`${dictionary.remove} ${index + 1}`}
                                      onClick={() =>
                                        setRows((current) => current.filter((item) => item.key !== row.key))
                                      }
                                    >
                                      <Trash2Icon />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">
          {dictionary.total_stock.replace("{stock}", String(total_stock))}
        </span>
        {can_edit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows((current) => [...current, newVariant("", "", "")])}
            >
              <PlusIcon />
              {dictionary.add_variant}
            </Button>
            {is_dirty && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setRows(initial)}>
                {common.cancel}
              </Button>
            )}
            <Button type="button" size="sm" onClick={onSave} disabled={!is_dirty || save_variants.isPending}>
              {save_variants.isPending && <Spinner aria-label={common.loading} />}
              {dictionary.save}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
