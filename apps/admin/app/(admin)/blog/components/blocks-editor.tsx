"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  HeadingIcon,
  ImageIcon,
  ImagesIcon,
  PilcrowIcon,
  QuoteIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { MediaPicker } from "@/components/media-picker";
import { LocalizedFields } from "@repo/admin-ui/components/localized-fields";
import { FormField } from "@repo/core/components/form-field";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { BLOG_BLOCK_TYPES, MAX_BLOG_BLOCKS, type BlogBlock } from "@repo/core/lib/schemas/blog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

const BLOCK_ICONS: Record<BlogBlock["type"], LucideIcon> = {
  paragraph: PilcrowIcon,
  heading: HeadingIcon,
  image: ImageIcon,
  quote: QuoteIcon,
};

function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newBlock(type: BlogBlock["type"]): BlogBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type, text: {} };
    case "image":
      return { id, type, url: "", alt: {}, caption: {} };
    case "quote":
      return { id, type, text: {}, cite: "" };
    default:
      return { id, type: "paragraph", text: {} };
  }
}

type BlocksEditorProps = {
  blocks: BlogBlock[];
  onChange: (blocks: BlogBlock[]) => void;
  lang: string;
  is_locked: boolean;
  status_labels: { filled: string; missing: string };
  dictionary: AdminDictionary["blog"]["editor"];
  files_picker: AdminDictionary["files"]["picker"];
  errors: AdminDictionary["errors"];
};

// The post body: paragraphs, headings, images and quotes, each with its text per store language.
export function BlocksEditor({
  blocks,
  onChange,
  lang,
  is_locked,
  status_labels,
  dictionary,
  files_picker,
  errors,
}: BlocksEditorProps) {
  // The image block whose picker is open.
  const [picking_id, setPickingId] = useState<string | null>(null);

  function update(id: string, patch: Partial<BlogBlock>) {
    onChange(blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as BlogBlock) : block)));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + by, 0, moved);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 && <p className="text-muted-foreground text-sm">{dictionary.body_empty}</p>}
      <ol className="flex flex-col gap-3">
        {blocks.map((block, index) => {
          const Icon = BLOCK_ICONS[block.type];
          const label = dictionary.blocks[block.type];
          const field_id = `block-${block.id}`;
          return (
            <li key={block.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </span>
                {!is_locked && (
                  <span className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      aria-label={dictionary.move_up.replace("{block}", label)}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === blocks.length - 1}
                      aria-label={dictionary.move_down.replace("{block}", label)}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={dictionary.remove_block.replace("{block}", label)}
                      onClick={() => onChange(blocks.filter((item) => item.id !== block.id))}
                    >
                      <Trash2Icon />
                    </Button>
                  </span>
                )}
              </div>

              {(block.type === "paragraph" || block.type === "heading" || block.type === "quote") && (
                <LocalizedFields
                  id={field_id}
                  label={label}
                  value={block.text}
                  onChange={(text) => update(block.id, { text })}
                  lang={lang}
                  status_labels={status_labels}
                  multiline={block.type !== "heading"}
                  rows={block.type === "paragraph" ? 5 : 2}
                  disabled={is_locked}
                />
              )}
              {block.type === "paragraph" && (
                <p className="text-muted-foreground text-xs">{dictionary.paragraph_hint}</p>
              )}
              {block.type === "quote" && (
                <FormField id={`${field_id}-cite`} label={dictionary.cite}>
                  {(control) => (
                    <Input
                      {...control}
                      value={block.cite}
                      maxLength={120}
                      disabled={is_locked}
                      onChange={(event) => update(block.id, { cite: event.target.value })}
                    />
                  )}
                </FormField>
              )}
              {block.type === "image" && (
                <div className="flex flex-col gap-3">
                  {block.url ? (
                    <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-md border">
                      <Image src={block.url} alt="" fill unoptimized sizes="40rem" className="object-contain" />
                    </div>
                  ) : null}
                  {!is_locked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => setPickingId(block.id)}
                    >
                      <ImagesIcon />
                      {block.url ? dictionary.change_image : dictionary.choose_image}
                    </Button>
                  )}
                  <FormField id={`${field_id}-alt`} label={dictionary.image_alt}>
                    {() => (
                      <LocalizedFields
                        id={`${field_id}-alt`}
                        label={dictionary.image_alt}
                        value={block.alt}
                        onChange={(alt) => update(block.id, { alt })}
                        lang={lang}
                        status_labels={status_labels}
                        disabled={is_locked}
                      />
                    )}
                  </FormField>
                  <FormField id={`${field_id}-caption`} label={dictionary.caption}>
                    {() => (
                      <LocalizedFields
                        id={`${field_id}-caption`}
                        label={dictionary.caption}
                        value={block.caption}
                        onChange={(caption) => update(block.id, { caption })}
                        lang={lang}
                        status_labels={status_labels}
                        disabled={is_locked}
                      />
                    )}
                  </FormField>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!is_locked && blocks.length < MAX_BLOG_BLOCKS && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">{dictionary.add_block}</span>
          {BLOG_BLOCK_TYPES.map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange([...blocks, newBlock(type)])}
              >
                <Icon />
                {dictionary.blocks[type]}
              </Button>
            );
          })}
        </div>
      )}

      <MediaPicker
        is_open={picking_id !== null}
        onOpenChange={(is_open) => !is_open && setPickingId(null)}
        mode="single"
        onPick={([item]) => {
          if (item && picking_id) update(picking_id, { url: item.url });
        }}
        can_upload={!is_locked}
        lang={lang}
        dictionary={files_picker}
        errors={errors}
      />
    </div>
  );
}
