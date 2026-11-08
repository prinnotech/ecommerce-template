"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import type { StorePage } from "@repo/core/actions/pages";
import { FormField } from "@repo/core/components/form-field";
import { isLocale, LOCALES } from "@repo/core/i18nConfig";
import { useCreatePage, useUpdatePage } from "@repo/core/hooks/use-pages";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { LocalizedText } from "@repo/core/lib/localized";
import { create_page_schema, update_page_schema } from "@repo/core/lib/schemas/pages";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";
import { slugify } from "@repo/core/lib/slug";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";

type PageDialogProps = {
  // null = create a page.
  page: StorePage | null;
  is_open: boolean;
  onOpenChange: (is_open: boolean) => void;
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["custom_pages"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

// Mounted again for each page (key), so the fields start from that page's values.
export function PageDialog(props: PageDialogProps) {
  return (
    <Dialog open={props.is_open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <PageForm key={props.page?.id ?? "new"} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function PageForm({ page, onOpenChange, lang, can_edit, dictionary, common, errors, validation }: PageDialogProps) {
  const router = useRouter();
  const create = useCreatePage();
  const update = useUpdatePage();
  const locale = isLocale(lang) ? lang : LOCALES[0];
  const [title, setTitle] = useState<LocalizedText>(page?.title ?? {});
  const [slug, setSlug] = useState(page?.slug ?? "");
  // A new page's address follows its title until the address is edited by hand.
  const [is_slug_edited, setIsSlugEdited] = useState(Boolean(page));
  const [seo_title, setSeoTitle] = useState<LocalizedText>(page?.seo.title ?? {});
  const [seo_description, setSeoDescription] = useState<LocalizedText>(page?.seo.description ?? {});
  const [is_published, setIsPublished] = useState(page?.is_published ?? false);
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const is_pending = create.isPending || update.isPending;
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);
  const onError = (mutation_error: unknown) => toast.error(errorText(errors, mutation_error));

  function changeTitle(next: LocalizedText) {
    setTitle(next);
    if (!is_slug_edited) setSlug(slugify(next[locale] ?? Object.values(next).find(Boolean) ?? ""));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page) {
      const parsed = create_page_schema.safeParse({ title, slug });
      if (!parsed.success) return setFieldErrors(fieldErrors(parsed.error));
      setFieldErrors({});
      create.mutate(parsed.data, {
        onSuccess: (created) => {
          toast.success(dictionary.created);
          onOpenChange(false);
          // Straight to the editor, where the page gets its content.
          router.push(`/themes/live?page=page:${created.id}`);
        },
        onError,
      });
      return;
    }
    const parsed = update_page_schema.safeParse({
      id: page.id,
      title,
      slug,
      seo: { title: seo_title, description: seo_description },
      is_published,
    });
    if (!parsed.success) return setFieldErrors(fieldErrors(parsed.error));
    setFieldErrors({});
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(dictionary.saved);
        onOpenChange(false);
      },
      onError,
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{page ? dictionary.settings_title : dictionary.add_title}</DialogTitle>
        <DialogDescription>{page ? dictionary.settings_body : dictionary.add_body}</DialogDescription>
      </DialogHeader>

      <Field data-invalid={error("title") ? true : undefined}>
        <FieldLabel htmlFor="page-title">{dictionary.title_label}</FieldLabel>
        <LocalizedFields
          id="page-title"
          label={dictionary.title_label}
          value={title}
          onChange={changeTitle}
          lang={lang}
          status_labels={status_labels}
          disabled={!can_edit}
          invalid={Boolean(error("title"))}
        />
        {error("title") && <p className="text-destructive text-sm">{error("title")}</p>}
      </Field>

      <FormField id="page-slug" label={dictionary.slug_label} description={dictionary.slug_hint} error={error("slug")}>
        {(control) => (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-sm">/pages/</span>
            <Input
              {...control}
              value={slug}
              disabled={!can_edit}
              onChange={(event) => {
                setIsSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
            />
          </div>
        )}
      </FormField>

      {page && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="page-published" className="text-sm font-medium">
                {dictionary.published_label}
              </label>
              <p className="text-muted-foreground text-xs">{dictionary.published_hint}</p>
            </div>
            <Switch id="page-published" checked={is_published} disabled={!can_edit} onCheckedChange={setIsPublished} />
          </div>
          <Field>
            <FieldLabel htmlFor="page-seo-title">{dictionary.seo_title}</FieldLabel>
            <LocalizedFields
              id="page-seo-title"
              label={dictionary.seo_title}
              value={seo_title}
              onChange={setSeoTitle}
              lang={lang}
              status_labels={status_labels}
              disabled={!can_edit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="page-seo-description">{dictionary.seo_description}</FieldLabel>
            <LocalizedFields
              id="page-seo-description"
              label={dictionary.seo_description}
              value={seo_description}
              onChange={setSeoDescription}
              lang={lang}
              status_labels={status_labels}
              multiline
              rows={3}
              disabled={!can_edit}
            />
            <FieldDescription>{dictionary.seo_hint}</FieldDescription>
          </Field>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {common.cancel}
        </Button>
        {can_edit && (
          <Button type="submit" disabled={is_pending}>
            {is_pending && <Spinner />}
            {page ? common.save : dictionary.add_submit}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
