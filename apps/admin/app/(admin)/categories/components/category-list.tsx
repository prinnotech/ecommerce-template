"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, MoreHorizontalIcon, PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryDialog } from "./category-dialog";
import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { Page } from "@repo/admin-ui/components/page";
import { Thumbnail } from "@repo/admin-ui/components/thumbnail";
import type { AdminCategory } from "@repo/core/actions/categories";
import { useAdminCategories, useDeleteCategory, useMoveCategories } from "@repo/core/hooks/use-catalog";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { Locale } from "@repo/core/i18nConfig";
import { localized } from "@repo/core/lib/localized";
import { formatPlural } from "@repo/core/lib/utils/format";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";

const INDENT = 24;

type NestedCategory = AdminCategory & { children: NestedCategory[] };
type FlatCategory = { category: AdminCategory; depth: number };

function buildTree(categories: AdminCategory[]): NestedCategory[] {
  const by_id = new Map<string, NestedCategory>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  );
  const roots: NestedCategory[] = [];
  for (const node of by_id.values()) {
    const parent = node.parent ? by_id.get(node.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  function sortRecursive(nodes: NestedCategory[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((node) => sortRecursive(node.children));
  }
  sortRecursive(roots);
  return roots;
}

function flatten(nodes: NestedCategory[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [{ category: node, depth }, ...flatten(node.children, depth + 1)]);
}

type CategoryListProps = {
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["catalog"]["categories"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
  seo: AdminDictionary["admin_ui"]["seo"];
};

// null = closed, "new" = creating, AdminCategory = editing.
type DialogState = null | "new" | AdminCategory;

type CategoryRowProps = {
  item: FlatCategory;
  lang: string;
  can_edit: boolean;
  dictionary: AdminDictionary["catalog"]["categories"];
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
};

function CategoryRow({ item, lang, can_edit, dictionary, onEdit, onDelete }: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.category.id,
    disabled: !can_edit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const category = item.category;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 border-b px-4 py-2 last:border-b-0", isDragging && "opacity-40")}
    >
      {can_edit ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={dictionary.drag}
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none rounded-md p-1 outline-none active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="w-6" aria-hidden />
      )}
      {/* The whole row (thumbnail included) moves right with its depth, so nesting reads at a glance. */}
      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: item.depth * INDENT }}>
        <Thumbnail src={category.image_url} alt="" size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{localized(category.name, lang as Locale)}</span>
          <span className="text-muted-foreground truncate text-xs">
            <span className="font-mono">{category.slug}</span>
            {" · "}
            <span className="tabular-nums">{formatPlural(category.product_count, dictionary.product_count, lang)}</span>
          </span>
        </div>
      </div>
      <Badge variant={category.is_active ? "secondary" : "outline"}>
        {category.is_active ? dictionary.visible : dictionary.hidden}
      </Badge>
      {can_edit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={dictionary.more}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(category)}>{dictionary.edit}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(category)}>
              {dictionary.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

export function CategoryList({ lang, can_edit, dictionary, common, errors, validation, seo }: CategoryListProps) {
  const categories = useAdminCategories();
  const delete_category = useDeleteCategory();
  const move_categories = useMoveCategories();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending_delete, setPendingDelete] = useState<AdminCategory | null>(null);
  const [active_id, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [offset_left, setOffsetLeft] = useState(0);
  // Derived from the query during render (no setState in an effect).
  const flattened = categories.data ? flatten(buildTree(categories.data)) : [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
    setOffsetLeft(0);
  }

  function handleDragMove(event: DragMoveEvent) {
    setOffsetLeft(event.delta.x);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOffsetLeft(0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const old_index = flattened.findIndex((item) => item.category.id === active.id);
    const over_index = flattened.findIndex((item) => item.category.id === over.id);
    if (old_index < 0 || over_index < 0) return;

    const moved = arrayMove(flattened, old_index, over_index);
    // Horizontal drag distance controls nesting: further right = deeper.
    const drag_depth = Math.max(0, Math.round(offset_left / INDENT));
    const projected = flattened[old_index].depth + drag_depth;
    const previous = moved[over_index - 1];
    const next = moved[over_index + 1];
    const max_depth = previous ? previous.depth + 1 : 0;
    const min_depth = next ? next.depth : 0;
    moved[over_index] = { ...moved[over_index], depth: Math.min(Math.max(projected, min_depth), max_depth) };

    // Reconstruct each parent from the depth, then hand the whole tree to the backend.
    const moves = moved.map((item, index) => {
      let parent_id = "";
      for (let j = index - 1; j >= 0; j--) {
        const candidate = moved[j];
        if (candidate.depth === item.depth - 1) {
          parent_id = candidate.category.id;
          break;
        }
        if (candidate.depth < item.depth - 1) break;
      }
      return { id: item.category.id, parent_id, sort_order: index };
    });

    move_categories.mutate(moves, {
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  function onDelete(category: AdminCategory) {
    delete_category.mutate(category.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success(dictionary.deleted);
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  const active_item = flattened.find((item) => item.category.id === active_id);

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="full"
      secondary_actions={
        can_edit ? (
          <Button asChild variant="outline">
            <Link href="/products/import?type=categories">
              <UploadIcon />
              {dictionary.import}
            </Link>
          </Button>
        ) : undefined
      }
      primary_action={
        can_edit ? (
          <Button onClick={() => setDialog("new")}>
            <PlusIcon />
            {dictionary.add}
          </Button>
        ) : undefined
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={flattened.map((item) => item.category.id)} strategy={verticalListSortingStrategy}>
          {categories.isPending ? (
            <div className="bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-4 ring-1">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : categories.isError ? (
            <p className="text-destructive text-sm">{errorText(errors, categories.error)}</p>
          ) : flattened.length === 0 ? (
            <p className="bg-card text-muted-foreground ring-foreground/10 rounded-xl p-6 text-sm ring-1">
              {dictionary.empty}
            </p>
          ) : (
            <ul className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl text-sm ring-1">
              {flattened.map((item) => (
                <CategoryRow
                  key={item.category.id}
                  item={item}
                  lang={lang}
                  can_edit={can_edit}
                  dictionary={dictionary}
                  onEdit={(category) => setDialog(category)}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          )}
        </SortableContext>
        <DragOverlay>
          {active_item ? (
            <div
              className="bg-card ring-foreground/10 rounded-md px-4 py-2 text-sm font-medium shadow-lg ring-1"
              style={{ marginLeft: Math.max(0, active_item.depth * INDENT + offset_left) }}
            >
              {localized(active_item.category.name, lang as Locale)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
        seo={seo}
      />

      <ConfirmDialog
        is_open={pending_delete !== null}
        onOpenChange={(is_open) => !is_open && setPendingDelete(null)}
        title={dictionary.delete_title}
        body={dictionary.delete_body}
        confirm_label={dictionary.delete}
        cancel_label={common.cancel}
        onConfirm={() => pending_delete && onDelete(pending_delete)}
        is_pending={delete_category.isPending}
        is_destructive
      />
    </Page>
  );
}
