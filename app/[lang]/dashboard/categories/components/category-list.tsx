"use client";

import { ImageIcon, PlusIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryDialog } from "./category-dialog";
import type { AdminCategory } from "@/app/actions/categories";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminCategories, useDeleteCategory } from "@/hooks/use-catalog";
import type { Locale } from "@/i18nConfig";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import { localized } from "@/lib/localized";

type CategoryListProps = {
  lang: string;
  dictionary: Dictionary["catalog"]["categories"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

// null = closed, "new" = creating, AdminCategory = editing.
type DialogState = null | "new" | AdminCategory;

export function CategoryList({ lang, dictionary, common, errors, validation }: CategoryListProps) {
  const categories = useAdminCategories();
  const delete_category = useDeleteCategory();
  const [dialog, setDialog] = useState<DialogState>(null);
  const name = (category: AdminCategory) => localized(category.name, lang as Locale);

  function onDelete(category: AdminCategory) {
    delete_category.mutate(category.id, {
      onSuccess: () => toast.success(dictionary.deleted),
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  // Parent categories first, each followed by its children.
  const rows: { category: AdminCategory; depth: number }[] = [];
  if (categories.data) {
    const ids = new Set(categories.data.map((category) => category.id));
    for (const parent of categories.data.filter((category) => !category.parent || !ids.has(category.parent))) {
      rows.push({ category: parent, depth: 0 });
      for (const child of categories.data.filter((category) => category.parent === parent.id)) {
        rows.push({ category: child, depth: 1 });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.title}</h1>
          <p className="text-muted-foreground text-sm">{dictionary.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/${lang}/dashboard/products/import?type=categories`}>
              <UploadIcon />
              {dictionary.import}
            </Link>
          </Button>
          <Button onClick={() => setDialog("new")}>
            <PlusIcon />
            {dictionary.add}
          </Button>
        </div>
      </div>

      <Card className="py-0">
        {categories.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : categories.isError ? (
          <p className="text-destructive p-6 text-sm">{errorText(errors, categories.error)}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">{dictionary.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{dictionary.columns.name}</TableHead>
                <TableHead className="hidden sm:table-cell">{dictionary.columns.slug}</TableHead>
                <TableHead className="text-right">{dictionary.columns.products}</TableHead>
                <TableHead>{dictionary.columns.status}</TableHead>
                <TableHead className="pr-4">
                  <span className="sr-only">{dictionary.edit}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ category, depth }) => (
                <TableRow key={category.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3" style={{ paddingLeft: depth * 24 }}>
                      <div className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
                        {category.image_url ? (
                          <Image
                            src={category.image_url}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="text-muted-foreground size-4" aria-hidden />
                        )}
                      </div>
                      <span className="font-medium">{name(category)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">
                    {category.slug}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{category.product_count}</TableCell>
                  <TableCell>
                    <Badge variant={category.is_active ? "secondary" : "outline"}>
                      {category.is_active ? dictionary.visible : dictionary.hidden}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDialog(category)}>
                        {dictionary.edit}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            {dictionary.delete}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{dictionary.delete_title}</AlertDialogTitle>
                            <AlertDialogDescription>{dictionary.delete_body}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => onDelete(category)}>
                              {dictionary.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CategoryDialog
        key={dialog === null ? "closed" : dialog === "new" ? "new" : dialog.id}
        lang={lang}
        category={dialog !== null && dialog !== "new" ? dialog : null}
        categories={categories.data ?? []}
        is_open={dialog !== null}
        onOpenChange={(is_open) => !is_open && setDialog(null)}
        dictionary={dictionary}
        common={common}
        errors={errors}
        validation={validation}
      />
    </div>
  );
}
