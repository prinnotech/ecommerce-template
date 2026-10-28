"use client";

import { PlusIcon, Trash2Icon, WandSparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AdminVariant } from "@/app/actions/products";
import { MoneyInput } from "@/components/dashboard/money-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSaveVariants } from "@/hooks/use-catalog";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { save_variants_schema, type VariantInput } from "@/lib/schemas/catalog";

type Row = { key: string; variant: VariantInput };
type ColorOption = { key: string; name: string; hex: string };

type ProductVariantsProps = {
  product_id: string;
  slug: string;
  variants: AdminVariant[];
  can_edit: boolean;
  currency: string;
  dictionary: Dictionary["catalog"]["variants"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
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
    toast.success(dictionary.generated.replace("{count}", String(added.length)));
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
        <div className="-mx-6 overflow-x-auto px-6">
          <Table className="min-w-[44rem]">
            <TableHeader>
              <TableRow>
                <TableHead>{dictionary.columns.color}</TableHead>
                <TableHead className="w-24">{dictionary.columns.size}</TableHead>
                <TableHead>{dictionary.columns.sku}</TableHead>
                <TableHead className="w-36">
                  {dictionary.columns.price}
                  <span className="text-muted-foreground block text-xs font-normal">{dictionary.price_hint}</span>
                </TableHead>
                <TableHead className="w-24">{dictionary.columns.stock}</TableHead>
                <TableHead className="w-16">{dictionary.columns.active}</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">{dictionary.remove}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const label = (column: string) => `${column} ${index + 1}`;
                return (
                  <TableRow key={row.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={label(dictionary.color_value)}
                          value={row.variant.color_hex || "#000000"}
                          disabled={!can_edit}
                          onChange={(event) => updateRow(row.key, { color_hex: event.target.value })}
                          className="border-input size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                        />
                        <Input
                          aria-label={label(dictionary.columns.color)}
                          value={row.variant.color}
                          disabled={!can_edit}
                          onChange={(event) => updateRow(row.key, { color: event.target.value })}
                        />
                      </div>
                    </TableCell>
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
                          onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
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
