"use client";

import { ExternalLinkIcon, ImagesIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BlocksEditor } from "./blocks-editor";
import { POST_TONE } from "./blog-table";
import { MediaPicker } from "@/components/media-picker";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { Page } from "@repo/admin-ui/components/page";
import { SaveBar } from "@repo/admin-ui/components/save-bar";
import { SeoFields } from "@repo/admin-ui/components/seo-fields";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { BlogPost } from "@repo/core/actions/blog";
import { FormField } from "@repo/core/components/form-field";
import { useCreateBlogPost, useDeleteBlogPost, useUpdateBlogPost } from "@repo/core/hooks/use-blog";
import type { Locale } from "@repo/core/i18nConfig";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { localized, type LocalizedText } from "@repo/core/lib/localized";
import {
  EMPTY_BLOG_POST,
  MAX_BLOG_TAGS,
  blog_post_input_schema,
  blogPostStatus,
  toTag,
  type BlogPostInput,
} from "@repo/core/lib/schemas/blog";
import { SITE_URL } from "@repo/core/lib/site-config";
import { slugify } from "@repo/core/lib/slug";
import { formatDateTime } from "@repo/core/lib/utils/format";
import { fromZonedInput, toZonedInput } from "@repo/core/lib/utils/zoned-input";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Switch } from "@repo/ui/components/ui/switch";

type PostEditorProps = {
  lang: string;
  time_zone: string;
  can_edit: boolean;
  // null = a new post.
  post: BlogPost | null;
  dictionary: AdminDictionary["blog"];
  seo: AdminDictionary["admin_ui"]["seo"];
  common: AdminDictionary["common"];
  confirm: AdminDictionary["admin_ui"]["confirm"];
  save_bar: AdminDictionary["admin_ui"]["save_bar"];
  files_picker: AdminDictionary["files"]["picker"];
  errors: AdminDictionary["errors"];
};

function firstText(text: LocalizedText): string {
  return Object.values(text).find((value) => value && value.trim()) ?? "";
}

// The form keeps the publish date as datetime-local text in the store's time zone.
function initialForm(post: BlogPost | null, time_zone: string): BlogPostInput {
  if (!post) return EMPTY_BLOG_POST;
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    cover_url: post.cover_url,
    cover_alt: post.cover_alt,
    tags: post.tags,
    author: post.author,
    seo: post.seo,
    is_published: post.is_published,
    published_at: toZonedInput(post.published_at, time_zone),
  };
}

export function PostEditor({
  lang,
  time_zone,
  can_edit,
  post,
  dictionary,
  seo,
  common,
  confirm,
  save_bar,
  files_picker,
  errors,
}: PostEditorProps) {
  const router = useRouter();
  const create = useCreateBlogPost();
  const update = useUpdateBlogPost(post?.id ?? "");
  const remove = useDeleteBlogPost();
  const initial = initialForm(post, time_zone);
  const [form, setForm] = useState<BlogPostInput>(initial);
  const [is_slug_manual, setIsSlugManual] = useState(post !== null);
  const [tag_input, setTagInput] = useState("");
  const [is_cover_open, setIsCoverOpen] = useState(false);
  const [is_delete_open, setIsDeleteOpen] = useState(false);
  const [is_submitted, setIsSubmitted] = useState(false);
  const set = (patch: Partial<BlogPostInput>) => setForm((current) => ({ ...current, ...patch }));
  const is_locked = !can_edit;
  const is_new = post === null;
  const locale = lang as Locale;
  const text = dictionary.editor;
  const status_labels = { filled: common.text_filled, missing: common.text_missing };
  const input = { ...form, published_at: fromZonedInput(form.published_at, time_zone) };
  const parsed = blog_post_input_schema.safeParse(input);
  const is_dirty = is_new || JSON.stringify(form) !== JSON.stringify(initial);
  const issue = (path: string) =>
    !parsed.success && (is_submitted || path !== "title") && parsed.error.issues.some((item) => item.path[0] === path);
  const status = blogPostStatus({ is_published: form.is_published, published_at: input.published_at });

  function addTags(raw: string) {
    const added = raw.split(",").map(toTag).filter(Boolean);
    if (added.length === 0) return;
    set({ tags: [...new Set([...form.tags, ...added])].slice(0, MAX_BLOG_TAGS) });
    setTagInput("");
  }

  function onSave() {
    setIsSubmitted(true);
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    const onError = (error: Error) => toast.error(errorText(errors, error));
    if (is_new) {
      create.mutate(parsed.data, {
        onError,
        onSuccess: ({ id }) => {
          toast.success(text.saved);
          router.replace(`/blog/${id}`);
        },
      });
      return;
    }
    update.mutate(parsed.data, {
      onError,
      onSuccess: () => {
        toast.success(text.saved);
        router.refresh();
      },
    });
  }

  const main = (
    <>
      <SectionCard>
        <FormField id="post-title" label={text.title} error={issue("title") ? text.title_required : undefined}>
          {() => (
            <LocalizedFields
              id="post-title"
              label={text.title}
              value={form.title}
              onChange={(title) => set({ title, slug: is_slug_manual ? form.slug : slugify(firstText(title)) })}
              lang={lang}
              status_labels={status_labels}
              disabled={is_locked}
              invalid={issue("title")}
            />
          )}
        </FormField>
        <FormField id="post-excerpt" label={text.excerpt} description={text.excerpt_hint}>
          {() => (
            <LocalizedFields
              id="post-excerpt"
              label={text.excerpt}
              value={form.excerpt}
              onChange={(excerpt) => set({ excerpt })}
              lang={lang}
              status_labels={status_labels}
              multiline
              rows={3}
              disabled={is_locked}
            />
          )}
        </FormField>
      </SectionCard>

      <SectionCard title={text.body}>
        <BlocksEditor
          blocks={form.body}
          onChange={(body) => set({ body })}
          lang={lang}
          is_locked={is_locked}
          status_labels={status_labels}
          dictionary={text}
          files_picker={files_picker}
          errors={errors}
        />
      </SectionCard>

      <SectionCard title={seo.card_title} description={seo.card_hint}>
        <SeoFields
          id="post-seo"
          value={form.seo}
          onChange={(value) => set({ seo: value })}
          fallback={{ title: form.title, description: form.excerpt }}
          url={(item) => `${SITE_URL}/${item}/blog/${form.slug || "…"}`}
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
      <SectionCard title={text.visibility}>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={form.is_published}
            disabled={is_locked}
            aria-label={text.published}
            onCheckedChange={(is_published) => set({ is_published })}
          />
          {text.published}
        </label>
        <FormField
          id="post-date"
          label={text.published_at}
          description={text.published_at_hint.replace("{zone}", time_zone)}
        >
          {(control) => (
            <Input
              {...control}
              type="datetime-local"
              value={form.published_at}
              disabled={is_locked}
              onChange={(event) => set({ published_at: event.target.value })}
            />
          )}
        </FormField>
        {post && post.status === "published" && (
          <Button asChild variant="ghost" size="sm" className="self-start">
            <a href={`${SITE_URL}/${lang}/blog/${post.slug}`} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              {text.view_on_store}
            </a>
          </Button>
        )}
      </SectionCard>

      <SectionCard title={text.cover}>
        {form.cover_url && (
          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-md border">
            <Image src={form.cover_url} alt="" fill unoptimized sizes="20rem" className="object-cover" />
          </div>
        )}
        {!is_locked && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCoverOpen(true)}>
              <ImagesIcon />
              {form.cover_url ? text.change_image : text.choose_image}
            </Button>
            {form.cover_url && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ cover_url: "", cover_alt: {} })}>
                {text.remove_image}
              </Button>
            )}
          </div>
        )}
        {form.cover_url && (
          <FormField id="post-cover-alt" label={text.image_alt}>
            {() => (
              <LocalizedFields
                id="post-cover-alt"
                label={text.image_alt}
                value={form.cover_alt}
                onChange={(cover_alt) => set({ cover_alt })}
                lang={lang}
                status_labels={status_labels}
                disabled={is_locked}
              />
            )}
          </FormField>
        )}
      </SectionCard>

      <SectionCard title={text.organization}>
        <FormField id="post-author" label={text.author}>
          {(control) => (
            <Input
              {...control}
              value={form.author}
              maxLength={80}
              disabled={is_locked}
              onChange={(event) => set({ author: event.target.value })}
            />
          )}
        </FormField>
        <FormField id="post-tags" label={text.tags} description={text.tags_hint}>
          {(control) => (
            <Input
              {...control}
              value={tag_input}
              disabled={is_locked || form.tags.length >= MAX_BLOG_TAGS}
              onChange={(event) => setTagInput(event.target.value)}
              onBlur={() => addTags(tag_input)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTags(tag_input);
                }
              }}
            />
          )}
        </FormField>
        {form.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {form.tags.map((tag) => (
              <li key={tag} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                {tag}
                {!is_locked && (
                  <button
                    type="button"
                    aria-label={text.remove_tag.replace("{tag}", tag)}
                    onClick={() => set({ tags: form.tags.filter((item) => item !== tag) })}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <FormField
          id="post-slug"
          label={text.slug}
          description={text.slug_hint.replace("{path}", `/blog/${form.slug || "…"}`)}
          error={issue("slug") && form.slug ? text.slug_invalid : undefined}
        >
          {(control) => (
            <Input
              {...control}
              value={form.slug}
              className="font-mono"
              disabled={is_locked}
              onChange={(event) => {
                setIsSlugManual(true);
                set({ slug: slugify(event.target.value) });
              }}
            />
          )}
        </FormField>
      </SectionCard>

      {post && (
        <p className="text-muted-foreground px-1 text-xs">
          {text.updated.replace("{date}", formatDateTime(post.updated_at, lang))}
        </p>
      )}
      {post && can_edit && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive self-start"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2Icon />
          {text.delete}
        </Button>
      )}
    </>
  );

  return (
    <Page
      title={is_new ? text.new_title : localized(post.title, locale) || post.slug}
      title_meta={<StatusBadge tone={POST_TONE[status]}>{dictionary.status[status]}</StatusBadge>}
      back={{ href: "/blog", label: dictionary.title }}
    >
      <DetailLayout main={main} sidebar={sidebar} />
      <MediaPicker
        is_open={is_cover_open}
        onOpenChange={setIsCoverOpen}
        mode="single"
        onPick={([item]) => item && set({ cover_url: item.url, cover_alt: form.cover_alt })}
        can_upload={!is_locked}
        lang={lang}
        dictionary={files_picker}
        errors={errors}
      />
      {post && (
        <ConfirmDialog
          is_open={is_delete_open}
          onOpenChange={setIsDeleteOpen}
          title={text.delete_title}
          body={text.delete_body}
          confirm_label={text.delete}
          cancel_label={confirm.cancel}
          is_pending={remove.isPending}
          is_destructive
          onConfirm={() =>
            remove.mutate(post.id, {
              onSuccess: () => router.push("/blog"),
              onError: (error) => toast.error(errorText(errors, error)),
            })
          }
        />
      )}
      {can_edit && (
        <SaveBar
          is_dirty={is_dirty}
          is_saving={create.isPending || update.isPending}
          can_save={parsed.success}
          onDiscard={() => (is_new ? router.push("/blog") : setForm(initial))}
          onSave={onSave}
          dictionary={save_bar}
        />
      )}
    </Page>
  );
}
