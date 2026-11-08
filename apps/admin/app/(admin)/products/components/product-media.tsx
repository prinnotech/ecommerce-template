"use client";

import { toast } from "sonner";

import { ImageManager, type ManagedImage } from "@repo/admin-ui/components/image-manager";
import type { AdminProductImage } from "@repo/core/actions/products";
import {
  useRemoveProductImage,
  useReorderProductImages,
  useSetProductImageColor,
  useUploadProductImage,
} from "@repo/core/hooks/use-catalog";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { Locale } from "@repo/core/i18nConfig";
import { localized, type LocalizedText } from "@repo/core/lib/localized";
import { MAX_PRODUCT_IMAGES } from "@repo/core/lib/schemas/catalog";

type ProductMediaProps = {
  product_id: string;
  title: LocalizedText;
  images: AdminProductImage[];
  color_options: { value: string; label: string }[];
  can_edit: boolean;
  lang: string;
  dictionary: AdminDictionary["catalog"]["editor"];
  images_dictionary: AdminDictionary["admin_ui"]["images"];
  errors: AdminDictionary["errors"];
};

// Shopify's media card, with each image assigned to a color (audit P5).
export function ProductMedia({
  product_id,
  title,
  images,
  color_options,
  can_edit,
  lang,
  dictionary,
  images_dictionary,
  errors,
}: ProductMediaProps) {
  const upload = useUploadProductImage(product_id);
  const remove = useRemoveProductImage();
  const reorder = useReorderProductImages();
  const set_color = useSetProductImageColor();
  const product_title = localized(title, lang as Locale);

  const managed: ManagedImage[] = images.map((image, index) => ({
    id: image.name,
    url: image.url,
    alt: dictionary.image_alt.replace("{number}", String(index + 1)).replace("{title}", product_title),
    color: image.color,
  }));

  function onUpload(files: File[]) {
    for (const file of files) {
      const form_data = new FormData();
      form_data.set("product_id", product_id);
      form_data.set("image", file);
      upload.mutate(form_data, { onError: (error) => toast.error(`${file.name}: ${errorText(errors, error)}`) });
    }
  }

  function onRemove(id: string) {
    remove.mutate({ product_id, image: id }, { onError: (error) => toast.error(errorText(errors, error)) });
  }

  function onMove(id: string, direction: -1 | 1) {
    const names = images.map((image) => image.name);
    const index = names.indexOf(id);
    if (index < 0) return;
    const [moved] = names.splice(index, 1);
    names.splice(index + direction, 0, moved);
    reorder.mutate({ product_id, images: names }, { onError: (error) => toast.error(errorText(errors, error)) });
  }

  function onColorChange(id: string, color: string) {
    set_color.mutate({ product_id, image: id, color }, { onError: (error) => toast.error(errorText(errors, error)) });
  }

  return (
    <ImageManager
      images={managed}
      can_edit={can_edit}
      is_busy={upload.isPending || remove.isPending || reorder.isPending || set_color.isPending}
      max_images={MAX_PRODUCT_IMAGES}
      onUpload={onUpload}
      onRemove={onRemove}
      onMove={onMove}
      color_options={color_options}
      onColorChange={onColorChange}
      dictionary={images_dictionary}
    />
  );
}
