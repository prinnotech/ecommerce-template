"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import type { AdminCategory } from "@repo/core/actions/categories";
import { SeoFields } from "@repo/admin-ui/components/seo-fields";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { FormField } from "@repo/core/components/form-field";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  useCreateCategory,
  useRemoveCategoryImage,
  useUpdateCategory,
  useUploadCategoryImage,
} from "@repo/core/hooks/use-catalog";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized, type LocalizedText } from "@repo/core/lib/localized";
import { category_schema, type CategoryInput } from "@repo/core/lib/schemas/catalog";
import { EMPTY_SEO } from "@repo/core/lib/schemas/seo";
import { SITE_URL } from "@repo/core/lib/site-config";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";
import { slugify } from "@repo/core/lib/slug";

type CategoryDialogProps = {
  lang: string;
  category: AdminCategory | null;
  categories: AdminCategory[];
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  dictionary: AdminDictionary["catalog"]["categories"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
  seo: AdminDictionary["admin_ui"]["seo"];
};

function firstText(text: LocalizedText): string {
  return LOCALES.map((locale) => text[locale]).find((value) => value && value.trim()) ?? "";
}

export function CategoryDialog({
  lang,
  category,
  categories,
  is_open,
  onOpenChange,
  dictionary,
  common,
  errors,
  validation,
  seo,
}: CategoryDialogProps) {
  const create_category = useCreateCategory();
  const update_category = useUpdateCategory();
  const upload_image = useUploadCategoryImage();
  const remove_image = useRemoveCategoryImage();
  const file_input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CategoryInput>(() => ({
    name: category?.name ?? {},
    slug: category?.slug ?? "",
    description: category?.description ?? {},
    parent: category?.parent ?? "",
    sort_order: category?.sort_order ?? 0,
    is_active: category?.is_active ?? true,
    seo: category?.seo ?? EMPTY_SEO,
  }));
  // New categories follow the name until the handle is edited by hand.
  const [is_slug_manual, setIsSlugManual] = useState(Boolean(category));
  const [image_url, setImageUrl] = useState(category?.image_url ?? "");
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const form = dictionary.form;
  const is_saving = create_category.isPending || update_category.isPending;

  // Only top-level categories can be parents, and never the category itself.
  const parent_options = categories.filter((option) => !option.parent && option.id !== category?.id);

  function onNameChange(name: LocalizedText) {
    setDraft((current) => ({ ...current, name, slug: is_slug_manual ? current.slug : slugify(firstText(name)) }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = category_schema.safeParse(draft);
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    const callbacks = {
      onSuccess: () => {
        toast.success(dictionary.saved);
        onOpenChange(false);
      },
      onError: (mutation_error: Error) => toast.error(errorText(errors, mutation_error)),
    };
    if (category) update_category.mutate({ ...parsed.data, id: category.id }, callbacks);
    else create_category.mutate(parsed.data, callbacks);
  }

  function onPickImage(file: File | undefined) {
    if (!file || !category) return;
    const form_data = new FormData();
    form_data.set("id", category.id);
    form_data.set("image", file);
    upload_image.mutate(form_data, {
      onSuccess: (result) => setImageUrl(result.image_url),
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  function onRemoveImage() {
    if (!category) return;
    remove_image.mutate(category.id, {
      onSuccess: () => setImageUrl(""),
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  return (
    <Dialog open={is_open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" closeLabel={common.close}>
        <DialogHeader>
          <DialogTitle>{category ? dictionary.edit_title : dictionary.add_title}</DialogTitle>
          <DialogDescription className="sr-only">
            {category ? localized(category.name, lang as Locale) : dictionary.add_title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            <FormField id="category-name" label={form.name} error={error("name")}>
              {(control) => (
                <LocalizedFields
                  lang={lang}
                  status_labels={{ filled: common.text_filled, missing: common.text_missing }}
                  id={control.id}
                  label={form.name}
                  value={draft.name}
                  onChange={onNameChange}
                  invalid={control["aria-invalid"]}
                  aria-describedby={control["aria-describedby"]}
                />
              )}
            </FormField>
            <FormField
              id="category-slug"
              label={form.slug}
              description={form.slug_hint.replace("{slug}", draft.slug || "…")}
              error={error("slug")}
            >
              {(control) => (
                <Input
                  {...control}
                  value={draft.slug}
                  className="font-mono text-sm"
                  onChange={(event) => {
                    setIsSlugManual(true);
                    setDraft((current) => ({ ...current, slug: event.target.value.toLowerCase() }));
                  }}
                />
              )}
            </FormField>
            <FormField id="category-description" label={form.description} optional_label={common.optional}>
              {(control) => (
                <LocalizedFields
                  lang={lang}
                  status_labels={{ filled: common.text_filled, missing: common.text_missing }}
                  id={control.id}
                  label={form.description}
                  multiline
                  rows={3}
                  value={draft.description}
                  onChange={(description) => setDraft((current) => ({ ...current, description }))}
                />
              )}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="category-parent" label={form.parent}>
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
                    value={draft.parent}
                    onChange={(event) => setDraft((current) => ({ ...current, parent: event.target.value }))}
                  >
                    <NativeSelectOption value="">{form.no_parent}</NativeSelectOption>
                    {parent_options.map((option) => (
                      <NativeSelectOption key={option.id} value={option.id}>
                        {localized(option.name, lang as Locale)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField id="category-sort" label={form.sort_order} description={form.sort_order_hint}>
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={0}
                    value={Number.isNaN(draft.sort_order) ? "" : draft.sort_order}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sort_order: event.target.valueAsNumber }))
                    }
                  />
                )}
              </FormField>
            </div>
            <Field orientation="horizontal">
              <Switch
                id="category-active"
                checked={draft.is_active}
                onCheckedChange={(is_active) => setDraft((current) => ({ ...current, is_active }))}
              />
              <FieldLabel htmlFor="category-active" className="font-normal">
                {form.is_active}
              </FieldLabel>
            </Field>

            <Field>
              <FieldLabel>{form.image}</FieldLabel>
              {category ? (
                <div className="flex items-center gap-4">
                  <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    {image_url ? (
                      <Image
                        src={image_url}
                        alt=""
                        width={64}
                        height={64}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="text-muted-foreground size-5" aria-hidden />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={file_input}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden
                      onChange={(event) => {
                        onPickImage(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={upload_image.isPending}
                      onClick={() => file_input.current?.click()}
                    >
                      {upload_image.isPending && <Spinner aria-label={common.loading} />}
                      {image_url ? form.replace_image : form.upload_image}
                    </Button>
                    {image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={remove_image.isPending}
                        onClick={onRemoveImage}
                      >
                        {form.remove_image}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{form.image_after_create}</p>
              )}
            </Field>
            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{seo.card_title}</summary>
              <div className="pt-3">
                <SeoFields
                  id="category-seo"
                  value={draft.seo}
                  onChange={(value) => setDraft((current) => ({ ...current, seo: value }))}
                  fallback={{ title: draft.name, description: draft.description }}
                  url={(locale) => `${SITE_URL}/${locale}/shop?category=${draft.slug || "…"}`}
                  lang={lang}
                  status_labels={{ filled: common.text_filled, missing: common.text_missing }}
                  dictionary={seo}
                />
              </div>
            </details>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common.cancel}
            </Button>
            <Button type="submit" disabled={is_saving}>
              {is_saving && <Spinner aria-label={common.loading} />}
              {form.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
