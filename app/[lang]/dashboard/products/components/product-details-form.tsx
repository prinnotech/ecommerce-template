"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { AdminProduct } from "@/app/actions/products";
import { LocalizedInput } from "@/components/dashboard/localized-input";
import { MoneyInput } from "@/components/dashboard/money-input";
import { FormField } from "@/components/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAdminCategories, useCreateProduct, useDeleteProduct, useUpdateProduct } from "@/hooks/use-catalog";
import { LOCALES, type Locale } from "@/i18nConfig";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { localized, type LocalizedText } from "@/lib/localized";
import { PRODUCT_STATUSES, product_schema, type ProductInput, type ProductStatus } from "@/lib/schemas/catalog";
import { fieldErrors, type FieldErrors } from "@/lib/schemas/validation";
import { slugify } from "@/lib/slug";

type Draft = Omit<ProductInput, "tags"> & { tags_text: string };

function toDraft(product: AdminProduct | null): Draft {
  return {
    title: product?.title ?? {},
    description: product?.description ?? {},
    slug: product?.slug ?? "",
    category: product?.category ?? "",
    price: product?.price ?? 0,
    compare_at_price: product?.compare_at_price ?? 0,
    status: product?.status ?? "draft",
    is_featured: product?.is_featured ?? false,
    tags_text: (product?.tags ?? []).join(", "),
  };
}

function toInput(draft: Draft): ProductInput {
  const { tags_text, ...fields } = draft;
  const tags = tags_text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return { ...fields, tags: [...new Set(tags)] };
}

function firstText(text: LocalizedText): string {
  return LOCALES.map((locale) => text[locale]).find((value) => value && value.trim()) ?? "";
}

type ProductDetailsFormProps = {
  lang: string;
  product: AdminProduct | null;
  can_edit: boolean;
  currency: string;
  media: ReactNode;
  variants: ReactNode;
  dictionary: Dictionary["catalog"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function ProductDetailsForm({
  lang,
  product,
  can_edit,
  currency,
  media,
  variants,
  dictionary,
  common,
  errors,
  validation,
}: ProductDetailsFormProps) {
  const router = useRouter();
  const categories = useAdminCategories();
  const create_product = useCreateProduct();
  const update_product = useUpdateProduct();
  const delete_product = useDeleteProduct();
  const [initial] = useState(() => toDraft(product));
  const [draft, setDraft] = useState<Draft>(initial);
  // New products follow the title until the handle is edited by hand.
  const [is_slug_manual, setIsSlugManual] = useState(Boolean(product));
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const text = dictionary.editor;
  const locale = lang as Locale;
  const is_dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const is_saving = create_product.isPending || update_product.isPending;
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const list_href = `/${lang}/dashboard/products`;
  const heading = product ? localized(product.title, locale) || dictionary.products.untitled : text.new_title;

  function onSave() {
    const parsed = product_schema.safeParse(toInput(draft));
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      toast.error(errors.invalid_input);
      return;
    }
    setFieldErrors({});
    const onError = (mutation_error: Error) => toast.error(errorText(errors, mutation_error));
    if (product) {
      update_product.mutate(
        { id: product.id, product: parsed.data },
        { onSuccess: () => toast.success(text.saved), onError },
      );
    } else {
      create_product.mutate(parsed.data, {
        onSuccess: ({ id }) => {
          toast.success(text.created);
          router.replace(`${list_href}/${id}`);
        },
        onError,
      });
    }
  }

  function onDelete() {
    if (!product) return;
    delete_product.mutate(product.id, {
      onSuccess: () => {
        toast.success(text.deleted);
        router.replace(list_href);
      },
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: stays visible while scrolling so Save is always reachable. */}
      <div className="bg-background/95 sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label={text.back}>
            <Link href={list_href}>
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="truncate text-lg font-semibold">{heading}</h1>
        </div>
        {can_edit && (
          <div className="flex items-center gap-2">
            {is_dirty && <span className="text-muted-foreground hidden text-sm sm:inline">{text.unsaved}</span>}
            {is_dirty && product && (
              <Button variant="ghost" size="sm" onClick={() => setDraft(initial)} disabled={is_saving}>
                {text.discard}
              </Button>
            )}
            <Button size="sm" onClick={onSave} disabled={is_saving || (Boolean(product) && !is_dirty)}>
              {is_saving && <Spinner aria-label={common.loading} />}
              {text.save}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{text.sections.details}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FormField id="product-title" label={text.title} error={error("title")}>
                  {(control) => (
                    <LocalizedInput
                      id={control.id}
                      label={text.title}
                      value={draft.title}
                      disabled={!can_edit}
                      invalid={control["aria-invalid"]}
                      aria-describedby={control["aria-describedby"]}
                      onChange={(title) =>
                        setDraft((current) => ({
                          ...current,
                          title,
                          slug: is_slug_manual ? current.slug : slugify(firstText(title)),
                        }))
                      }
                    />
                  )}
                </FormField>
                <FormField
                  id="product-description"
                  label={text.description}
                  description={text.description_hint}
                  optional_label={common.optional}
                >
                  {(control) => (
                    <LocalizedInput
                      id={control.id}
                      label={text.description}
                      multiline
                      rows={8}
                      value={draft.description}
                      disabled={!can_edit}
                      aria-describedby={control["aria-describedby"]}
                      onChange={(description) => set("description", description)}
                    />
                  )}
                </FormField>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.sections.media}</CardTitle>
              <CardDescription>{text.media_hint}</CardDescription>
            </CardHeader>
            <CardContent>{media ?? <p className="text-muted-foreground text-sm">{text.after_create}</p>}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.sections.variants}</CardTitle>
              <CardDescription>{dictionary.variants.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              {variants ?? <p className="text-muted-foreground text-sm">{text.after_create}</p>}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{text.sections.status}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField id="product-status" label={text.sections.status} description={text.status_hint}>
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
                    value={draft.status}
                    disabled={!can_edit}
                    onChange={(event) => set("status", event.target.value as ProductStatus)}
                  >
                    {PRODUCT_STATUSES.map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {dictionary.status[status]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.sections.pricing}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FormField id="product-price" label={text.price} error={error("price")}>
                  {(control) => (
                    <MoneyInput
                      id={control.id}
                      cents={draft.price}
                      currency={currency}
                      disabled={!can_edit}
                      invalid={control["aria-invalid"]}
                      aria-describedby={control["aria-describedby"]}
                      onChange={(price) => set("price", price)}
                    />
                  )}
                </FormField>
                <FormField
                  id="product-compare-at"
                  label={text.compare_at_price}
                  description={text.compare_at_hint}
                  error={error("compare_at_price")}
                >
                  {(control) => (
                    <MoneyInput
                      id={control.id}
                      cents={draft.compare_at_price}
                      currency={currency}
                      disabled={!can_edit}
                      invalid={control["aria-invalid"]}
                      aria-describedby={control["aria-describedby"]}
                      onChange={(compare_at_price) => set("compare_at_price", compare_at_price)}
                    />
                  )}
                </FormField>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.sections.organization}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FormField id="product-category" label={text.category}>
                  {(control) => (
                    <NativeSelect
                      {...control}
                      className="w-full"
                      value={draft.category}
                      disabled={!can_edit}
                      onChange={(event) => set("category", event.target.value)}
                    >
                      <NativeSelectOption value="">{text.no_category}</NativeSelectOption>
                      {(categories.data ?? []).map((category) => (
                        <NativeSelectOption key={category.id} value={category.id}>
                          {localized(category.name, locale)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField
                  id="product-tags"
                  label={text.tags}
                  description={text.tags_hint}
                  optional_label={common.optional}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.tags_text}
                      disabled={!can_edit}
                      onChange={(event) => set("tags_text", event.target.value)}
                    />
                  )}
                </FormField>
                <FormField
                  id="product-slug"
                  label={text.slug}
                  description={text.slug_hint.replace("{slug}", draft.slug || "…")}
                  error={error("slug")}
                >
                  {(control) => (
                    <Input
                      {...control}
                      className="font-mono text-sm"
                      value={draft.slug}
                      disabled={!can_edit}
                      onChange={(event) => {
                        setIsSlugManual(true);
                        set("slug", event.target.value.toLowerCase());
                      }}
                    />
                  )}
                </FormField>
                <Field orientation="horizontal">
                  <Switch
                    id="product-featured"
                    checked={draft.is_featured}
                    disabled={!can_edit}
                    onCheckedChange={(is_featured) => set("is_featured", is_featured)}
                  />
                  <FieldLabel htmlFor="product-featured" className="font-normal">
                    {text.featured}
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {product && can_edit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive self-start">
                  {text.delete}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{text.delete_title}</AlertDialogTitle>
                  <AlertDialogDescription>{text.delete_body}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onDelete}>
                    {text.delete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
