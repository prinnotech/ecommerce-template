"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { MoneyInput } from "@repo/admin-ui/components/money-input";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { SeoFields } from "@repo/admin-ui/components/seo-fields";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { CollectionProduct, CollectionView } from "@repo/core/actions/collections";
import { FormField } from "@repo/core/components/form-field";
import { useAdminCategories, useAdminProducts } from "@repo/core/hooks/use-catalog";
import { useCreateCollection, useDeleteCollection, useUpdateCollection } from "@repo/core/hooks/use-collections";
import { useUploadMedia } from "@repo/core/hooks/use-pages";
import { LOCALES, type Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized, type LocalizedText } from "@repo/core/lib/localized";
import { product_list_filters_schema } from "@repo/core/lib/schemas/catalog";
import {
  COLLECTION_SORTS,
  collection_schema,
  EMPTY_COLLECTION,
  FIELD_OPERATORS,
  RULE_FIELDS,
  type CollectionInput,
  type CollectionRule,
  type RuleField,
} from "@repo/core/lib/schemas/collections";
import { SITE_URL } from "@repo/core/lib/site-config";
import { slugify } from "@repo/core/lib/slug";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";

type CollectionEditorProps = {
  lang: string;
  currency: string;
  can_edit: boolean;
  // null = a new collection.
  view: CollectionView | null;
  dictionary: AdminDictionary["collections"];
  seo: AdminDictionary["admin_ui"]["seo"];
  common: AdminDictionary["common"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  errors: AdminDictionary["errors"];
};

function firstText(text: LocalizedText): string {
  return LOCALES.map((locale) => text[locale]).find((value) => value && value.trim()) ?? "";
}

function newRule(field: RuleField): CollectionRule {
  const operator = FIELD_OPERATORS[field][0] ?? "is";
  const value = field === "on_sale" || field === "in_stock" ? "true" : field === "price" ? "5000" : "";
  return { field, operator, value };
}

export function CollectionEditor({
  lang,
  currency,
  can_edit,
  view,
  dictionary,
  seo,
  common,
  confirm,
  save_bar,
  errors,
}: CollectionEditorProps) {
  const router = useRouter();
  const create = useCreateCollection();
  const update = useUpdateCollection(view?.collection.id ?? "");
  const remove = useDeleteCollection();
  const upload = useUploadMedia();
  const file_input = useRef<HTMLInputElement>(null);
  const categories = useAdminCategories();
  const locale = lang as Locale;
  const initial: CollectionInput = view
    ? {
        title: view.collection.title,
        slug: view.collection.slug,
        description: view.collection.description,
        image_url: view.collection.image_url,
        kind: view.collection.kind,
        rules: view.collection.rules,
        sort: view.collection.sort,
        is_published: view.collection.is_published,
        seo: view.collection.seo,
      }
    : EMPTY_COLLECTION;
  const [form, setForm] = useState<CollectionInput>(initial);
  const [products, setProducts] = useState<CollectionProduct[]>(view?.products ?? []);
  const [is_slug_manual, setIsSlugManual] = useState(view !== null);
  const [search, setSearch] = useState("");
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const search_results = useAdminProducts(product_list_filters_schema.parse({ search }));
  const set = (patch: Partial<CollectionInput>) => setForm((current) => ({ ...current, ...patch }));
  const is_locked = !can_edit;
  const parsed = collection_schema.safeParse(form);
  const initial_ids = (view?.products ?? []).map((product) => product.id).join(",");
  const product_ids = products.map((product) => product.id);
  const is_products_dirty = product_ids.join(",") !== initial_ids;
  const is_dirty = view === null || JSON.stringify(form) !== JSON.stringify(initial) || is_products_dirty;
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const is_saving = create.isPending || update.isPending;

  function setRules(conditions: CollectionRule[]) {
    set({ rules: { ...form.rules, conditions } });
  }

  function move(index: number, by: number) {
    const next = [...products];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(index + by, 0, item);
    setProducts(next);
  }

  function onSave() {
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    const onError = (error: Error) => toast.error(errorText(errors, error));
    if (view === null) {
      create.mutate(
        { collection: parsed.data, product_ids },
        {
          onError,
          onSuccess: ({ id }) => {
            toast.success(dictionary.saved);
            router.replace(`/collections/${id}`);
          },
        },
      );
      return;
    }
    update.mutate(
      { collection: parsed.data, product_ids: is_products_dirty || form.kind === "manual" ? product_ids : null },
      {
        onError,
        onSuccess: () => {
          toast.success(dictionary.saved);
          router.refresh();
        },
      },
    );
  }

  const main = (
    <>
      <SectionCard>
        <FormField id="collection-title" label={dictionary.fields.title}>
          {() => (
            <LocalizedFields
              id="collection-title"
              label={dictionary.fields.title}
              value={form.title}
              onChange={(title) => set({ title, slug: is_slug_manual ? form.slug : slugify(firstText(title)) })}
              lang={lang}
              status_labels={status_labels}
              disabled={is_locked}
            />
          )}
        </FormField>
        <FormField id="collection-description" label={dictionary.fields.description}>
          {() => (
            <LocalizedFields
              id="collection-description"
              label={dictionary.fields.description}
              value={form.description}
              onChange={(description) => set({ description })}
              lang={lang}
              status_labels={status_labels}
              multiline
              rows={4}
              disabled={is_locked}
            />
          )}
        </FormField>
        <FormField id="collection-slug" label={dictionary.fields.slug} description={`/collections/${form.slug || "…"}`}>
          {(control) => (
            <Input
              {...control}
              value={form.slug}
              disabled={is_locked}
              onChange={(event) => {
                setIsSlugManual(true);
                set({ slug: slugify(event.target.value) });
              }}
            />
          )}
        </FormField>
      </SectionCard>

      <SectionCard title={dictionary.products_title} description={dictionary.kind_hint}>
        <FormField id="collection-kind" label={dictionary.fields.kind}>
          {(control) => (
            <NativeSelect
              {...control}
              value={form.kind}
              disabled={is_locked}
              className="w-full"
              onChange={(event) => {
                const kind = event.target.value === "automatic" ? "automatic" : "manual";
                set({
                  kind,
                  sort: kind === "automatic" && form.sort === "manual" ? "newest" : form.sort,
                  rules:
                    kind === "automatic" && form.rules.conditions.length === 0
                      ? { match: "all", conditions: [newRule("tag")] }
                      : form.rules,
                });
              }}
            >
              <NativeSelectOption value="manual">{dictionary.kinds.manual}</NativeSelectOption>
              <NativeSelectOption value="automatic">{dictionary.kinds.automatic}</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>

        {form.kind === "automatic" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {dictionary.match_label}
              <NativeSelect
                aria-label={dictionary.match_label}
                value={form.rules.match}
                disabled={is_locked}
                onChange={(event) =>
                  set({ rules: { ...form.rules, match: event.target.value === "any" ? "any" : "all" } })
                }
              >
                <NativeSelectOption value="all">{dictionary.match.all}</NativeSelectOption>
                <NativeSelectOption value="any">{dictionary.match.any}</NativeSelectOption>
              </NativeSelect>
            </div>
            <ul className="flex flex-col gap-2">
              {form.rules.conditions.map((rule, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label={dictionary.rule_field}
                    value={rule.field}
                    disabled={is_locked}
                    onChange={(event) => {
                      const field = RULE_FIELDS.find((item) => item === event.target.value) ?? "tag";
                      setRules(
                        form.rules.conditions.map((item, position) => (position === index ? newRule(field) : item)),
                      );
                    }}
                  >
                    {RULE_FIELDS.map((field) => (
                      <NativeSelectOption key={field} value={field}>
                        {dictionary.rule_fields[field]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    aria-label={dictionary.rule_operator}
                    value={rule.operator}
                    disabled={is_locked}
                    onChange={(event) => {
                      const operator =
                        FIELD_OPERATORS[rule.field].find((item) => item === event.target.value) ?? rule.operator;
                      setRules(
                        form.rules.conditions.map((item, position) =>
                          position === index ? { ...item, operator } : item,
                        ),
                      );
                    }}
                  >
                    {FIELD_OPERATORS[rule.field].map((operator) => (
                      <NativeSelectOption key={operator} value={operator}>
                        {dictionary.rule_operators[operator]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <RuleValue
                    rule={rule}
                    disabled={is_locked}
                    currency={currency}
                    lang={lang}
                    categories={(categories.data ?? []).map((category) => ({
                      id: category.id,
                      name: localized(category.name, locale),
                    }))}
                    dictionary={dictionary}
                    onChange={(value) =>
                      setRules(
                        form.rules.conditions.map((item, position) => (position === index ? { ...item, value } : item)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={is_locked || form.rules.conditions.length <= 1}
                    aria-label={dictionary.remove_rule}
                    onClick={() => setRules(form.rules.conditions.filter((_item, position) => position !== index))}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
            {!is_locked && form.rules.conditions.length < 20 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setRules([...form.rules.conditions, newRule("tag")])}
              >
                <PlusIcon />
                {dictionary.add_rule}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!is_locked && (
              <div className="flex flex-col gap-1">
                <Input
                  type="search"
                  value={search}
                  placeholder={dictionary.search_products}
                  aria-label={dictionary.search_products}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search.trim() && (
                  <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
                    {(search_results.data?.items ?? [])
                      .filter((product) => !product_ids.includes(product.id))
                      .map((product) => (
                        <li key={product.id}>
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                            onClick={() =>
                              setProducts([
                                ...products,
                                {
                                  id: product.id,
                                  title: product.title,
                                  image_url: product.image_url,
                                  status: product.status,
                                },
                              ])
                            }
                          >
                            <Thumbnail src={product.image_url} alt="" size="sm" />
                            <span className="truncate">{localized(product.title, locale)}</span>
                            <PlusIcon className="text-muted-foreground ml-auto size-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
            {products.length === 0 ? (
              <p className="text-muted-foreground text-sm">{dictionary.no_products}</p>
            ) : (
              <ol className="divide-y rounded-md border">
                {products.map((product, index) => (
                  <li key={product.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-muted-foreground w-5 text-xs tabular-nums">{index + 1}</span>
                    <Thumbnail src={product.image_url} alt="" size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {localized(product.title, locale)}
                      {product.status !== "active" && (
                        <span className="text-muted-foreground text-xs"> · {dictionary.not_live}</span>
                      )}
                    </span>
                    {!is_locked && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          aria-label={dictionary.move_up}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === products.length - 1}
                          aria-label={dictionary.move_down}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={dictionary.remove_product}
                          onClick={() => setProducts(products.filter((item) => item.id !== product.id))}
                        >
                          <XIcon />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        <FormField id="collection-sort" label={dictionary.fields.sort}>
          {(control) => (
            <NativeSelect
              {...control}
              value={form.sort}
              disabled={is_locked}
              className="w-full"
              onChange={(event) =>
                set({ sort: COLLECTION_SORTS.find((item) => item === event.target.value) ?? "newest" })
              }
            >
              {COLLECTION_SORTS.filter((sort) => form.kind === "manual" || sort !== "manual").map((sort) => (
                <NativeSelectOption key={sort} value={sort}>
                  {dictionary.sorts[sort]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </SectionCard>

      <SectionCard title={seo.card_title} description={seo.card_hint}>
        <SeoFields
          id="collection-seo"
          value={form.seo}
          onChange={(value) => set({ seo: value })}
          fallback={{ title: form.title, description: form.description }}
          url={(item) => `${SITE_URL}/${item}/collections/${form.slug || "…"}`}
          lang={lang}
          disabled={is_locked}
          status_labels={status_labels}
          dictionary={seo}
        />
      </SectionCard>
    </>
  );

  const sidebar = (
    <>
      <SectionCard title={dictionary.status_title}>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={form.is_published}
            disabled={is_locked}
            aria-label={dictionary.published}
            onCheckedChange={(is_published) => set({ is_published })}
          />
          {dictionary.published}
        </label>
      </SectionCard>
      <SectionCard title={dictionary.image_title}>
        <Thumbnail src={form.image_url} alt="" size="lg" />
        {!is_locked && (
          <div className="flex flex-col gap-2">
            <input
              ref={file_input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              aria-label={dictionary.upload}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                upload.mutate(file, {
                  onSuccess: (item) => set({ image_url: item.url }),
                  onError: (error) => toast.error(errorText(errors, error)),
                });
                event.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => file_input.current?.click()}
              >
                {upload.isPending ? <Spinner /> : <UploadIcon />}
                {dictionary.upload}
              </Button>
              {form.image_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ image_url: "" })}>
                  {dictionary.remove_image}
                </Button>
              )}
            </div>
          </div>
        )}
      </SectionCard>
      {view && can_edit && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive self-start"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2Icon />
          {dictionary.delete}
        </Button>
      )}
    </>
  );

  return (
    <Page
      title={view ? localized(view.collection.title, locale) || view.collection.slug : dictionary.new_title}
      back={{ href: "/collections", label: dictionary.title }}
    >
      <DetailLayout main={main} sidebar={sidebar} />
      {view && (
        <ConfirmDialog
          is_open={is_delete_open}
          onOpenChange={setIsDeleteOpen}
          title={dictionary.delete_title}
          body={dictionary.delete_body}
          confirm_label={dictionary.delete}
          cancel_label={confirm.cancel}
          is_pending={remove.isPending}
          is_destructive
          onConfirm={() =>
            remove.mutate(view.collection.id, {
              onSuccess: () => router.push("/collections"),
              onError: (error) => toast.error(errorText(errors, error)),
            })
          }
        />
      )}
      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={is_saving}
          can_save={parsed.success}
          onDiscard={() => {
            if (view === null) router.push("/collections");
            else {
              setForm(initial);
              setProducts(view.products);
            }
          }}
          onSave={onSave}
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}

function RuleValue({
  rule,
  disabled,
  currency,
  lang,
  categories,
  dictionary,
  onChange,
}: {
  rule: CollectionRule;
  disabled: boolean;
  currency: string;
  lang: string;
  categories: { id: string; name: string }[];
  dictionary: AdminDictionary["collections"];
  onChange: (value: string) => void;
}) {
  if (rule.field === "category") {
    return (
      <NativeSelect
        aria-label={dictionary.rule_value}
        value={rule.value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">{dictionary.choose_category}</NativeSelectOption>
        {categories.map((category) => (
          <NativeSelectOption key={category.id} value={category.id}>
            {category.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  if (rule.field === "on_sale" || rule.field === "in_stock") {
    return (
      <NativeSelect
        aria-label={dictionary.rule_value}
        value={rule.value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="true">{dictionary.yes}</NativeSelectOption>
        <NativeSelectOption value="false">{dictionary.no}</NativeSelectOption>
      </NativeSelect>
    );
  }
  if (rule.field === "price") {
    return (
      <MoneyInput
        id={`rule-price-${rule.value}`}
        aria-label={dictionary.rule_value}
        cents={Number(rule.value) || 0}
        onChange={(cents) => onChange(String(Number.isFinite(cents) ? Math.max(0, cents) : 0))}
        currency={currency}
        lang={lang}
        disabled={disabled}
        className="w-36"
      />
    );
  }
  return (
    <Input
      aria-label={dictionary.rule_value}
      value={rule.value}
      disabled={disabled}
      placeholder={dictionary.tag_placeholder}
      className="w-40"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
