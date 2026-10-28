"use client";

import { ProductDetailsForm } from "./product-details-form";
import { ProductMedia } from "./product-media";
import { ProductVariants } from "./product-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminProduct } from "@/hooks/use-catalog";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";

type ProductEditorProps = {
  lang: string;
  product_id: string | null;
  can_edit: boolean;
  currency: string;
  dictionary: Dictionary["catalog"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function ProductEditor(props: ProductEditorProps) {
  if (!props.product_id) return <ProductDetailsForm {...props} product={null} media={null} variants={null} />;
  return <ExistingProductEditor {...props} product_id={props.product_id} />;
}

function ExistingProductEditor(props: ProductEditorProps & { product_id: string }) {
  const product = useAdminProduct(props.product_id);

  if (product.isPending) return <Skeleton className="h-[32rem] w-full" />;
  if (product.isError) return <p className="text-destructive text-sm">{errorText(props.errors, product.error)}</p>;

  const data = product.data;
  return (
    <ProductDetailsForm
      {...props}
      // Remount only when the saved details change (not after an image upload), so drafts survive.
      key={JSON.stringify([
        data.title,
        data.description,
        data.slug,
        data.category,
        data.price,
        data.compare_at_price,
        data.status,
        data.is_featured,
        data.tags,
      ])}
      product={data}
      media={
        <ProductMedia
          product_id={data.id}
          title={data.title}
          images={data.images}
          can_edit={props.can_edit}
          lang={props.lang}
          dictionary={props.dictionary.editor}
          common={props.common}
          errors={props.errors}
        />
      }
      variants={
        <ProductVariants
          key={JSON.stringify(data.variants)}
          product_id={data.id}
          slug={data.slug}
          variants={data.variants}
          can_edit={props.can_edit}
          currency={props.currency}
          dictionary={props.dictionary.variants}
          common={props.common}
          errors={props.errors}
        />
      }
    />
  );
}
