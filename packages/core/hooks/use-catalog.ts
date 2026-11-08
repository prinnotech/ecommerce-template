"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCategory,
  deleteCategory,
  getAdminCategories,
  moveCategories,
  removeCategoryImage,
  updateCategory,
  uploadCategoryImage,
} from "@repo/core/actions/categories";
import {
  bulkDeleteProducts,
  bulkSetProductCategory,
  bulkSetProductStatus,
  createProduct,
  deleteProduct,
  getAdminProduct,
  getAdminProducts,
  removeProductImage,
  reorderProductImages,
  saveVariants,
  setProductImageColor,
  updateProduct,
  uploadProductImage,
  type AdminProduct,
  type AdminProductImage,
} from "@repo/core/actions/products";
import { importCategories, importProducts } from "@repo/core/actions/catalog-import";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { ImportCategoriesInput, ImportProductsInput } from "@repo/core/lib/schemas/catalog-import";
import type {
  BulkProductCategoryInput,
  BulkProductStatusInput,
  BulkProductsInput,
  CategoryInput,
  ImageColorInput,
  ImageOrderInput,
  MoveCategoriesInput,
  ProductInput,
  ProductListFilters,
  RemoveImageInput,
  SaveVariantsInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from "@repo/core/lib/schemas/catalog";

// ---------- Categories ----------

export function useAdminCategories() {
  return useQuery({ queryKey: query_keys.admin_categories, queryFn: async () => unwrap(await getAdminCategories()) });
}

function useInvalidateCategories() {
  const query_client = useQueryClient();
  return () => query_client.invalidateQueries({ queryKey: query_keys.admin_categories });
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (input: CategoryInput) => unwrap(await createCategory(input)),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (input: UpdateCategoryInput) => unwrap(await updateCategory(input)),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: async (id: string) => unwrap(await deleteCategory(id)), onSuccess: invalidate });
}

export function useUploadCategoryImage() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (form_data: FormData) => unwrap(await uploadCategoryImage(form_data)),
    onSuccess: invalidate,
  });
}

export function useRemoveCategoryImage() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeCategoryImage(id)),
    onSuccess: invalidate,
  });
}

// ---------- Products ----------

export function useAdminProducts(filters: ProductListFilters) {
  return useQuery({
    queryKey: query_keys.admin_products(filters),
    queryFn: async () => unwrap(await getAdminProducts(filters)),
    // Keep the current page on screen while the next filter/page loads.
    placeholderData: keepPreviousData,
  });
}

export function useAdminProduct(id: string) {
  return useQuery({ queryKey: query_keys.admin_product(id), queryFn: async () => unwrap(await getAdminProduct(id)) });
}

function useInvalidateProducts() {
  const query_client = useQueryClient();
  return (id?: string) =>
    Promise.all([
      query_client.invalidateQueries({ queryKey: query_keys.admin_products_all }),
      id ? query_client.invalidateQueries({ queryKey: query_keys.admin_product(id) }) : null,
      // Category product counts change with products.
      query_client.invalidateQueries({ queryKey: query_keys.admin_categories }),
    ]);
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: ProductInput) => unwrap(await createProduct(input)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: UpdateProductInput) => unwrap(await updateProduct(input)),
    onSuccess: (_data, input) => invalidate(input.id),
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteProduct(id)),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useSaveVariants() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: SaveVariantsInput) => unwrap(await saveVariants(input)),
    onSuccess: (_data, input) => invalidate(input.product_id),
  });
}

// Image mutations write the returned list straight into the product cache, so the grid updates at once.
function useSetProductImages() {
  const query_client = useQueryClient();
  return (product_id: string, images: AdminProductImage[]) => {
    query_client.setQueryData<AdminProduct>(query_keys.admin_product(product_id), (product) =>
      product ? { ...product, images } : product,
    );
    // The list shows the first image as the thumbnail.
    return query_client.invalidateQueries({ queryKey: query_keys.admin_products_all });
  };
}

export function useUploadProductImage(product_id: string) {
  const setImages = useSetProductImages();
  return useMutation({
    mutationFn: async (form_data: FormData) => unwrap(await uploadProductImage(form_data)),
    onSuccess: (images) => setImages(product_id, images),
  });
}

export function useRemoveProductImage() {
  const setImages = useSetProductImages();
  return useMutation({
    mutationFn: async (input: RemoveImageInput) => unwrap(await removeProductImage(input)),
    onSuccess: (images, input) => setImages(input.product_id, images),
  });
}

export function useReorderProductImages() {
  const setImages = useSetProductImages();
  return useMutation({
    mutationFn: async (input: ImageOrderInput) => unwrap(await reorderProductImages(input)),
    onSuccess: (images, input) => setImages(input.product_id, images),
  });
}

export function useSetProductImageColor() {
  const setImages = useSetProductImages();
  return useMutation({
    mutationFn: async (input: ImageColorInput) => unwrap(await setProductImageColor(input)),
    onSuccess: (images, input) => setImages(input.product_id, images),
  });
}

// ---------- Bulk actions ----------

export function useBulkSetProductStatus() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: BulkProductStatusInput) => unwrap(await bulkSetProductStatus(input)),
    onSuccess: () => invalidate(),
  });
}

export function useBulkSetProductCategory() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: BulkProductCategoryInput) => unwrap(await bulkSetProductCategory(input)),
    onSuccess: () => invalidate(),
  });
}

export function useBulkDeleteProducts() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async (input: BulkProductsInput) => unwrap(await bulkDeleteProducts(input)),
    onSuccess: () => invalidate(),
  });
}

export function useMoveCategories() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: async (input: MoveCategoriesInput) => unwrap(await moveCategories(input)),
    // Refetch on error too: the tree on screen was moved optimistically.
    onSettled: () => query_client.invalidateQueries({ queryKey: query_keys.admin_categories }),
  });
}

// ---------- CSV import ----------

// One request per chunk; the import page loops over chunks and invalidates the lists once at the end
// (useInvalidateCatalog), so the dashboard doesn't refetch after every few products.
export function useImportProducts() {
  return useMutation({ mutationFn: async (input: ImportProductsInput) => unwrap(await importProducts(input)) });
}

export function useImportCategories() {
  return useMutation({ mutationFn: async (input: ImportCategoriesInput) => unwrap(await importCategories(input)) });
}

export function useInvalidateCatalog() {
  const query_client = useQueryClient();
  return () =>
    Promise.all([
      query_client.invalidateQueries({ queryKey: query_keys.admin_products_all }),
      query_client.invalidateQueries({ queryKey: query_keys.admin_categories }),
    ]);
}
