import { Skeleton } from "@repo/ui/components/ui/skeleton";

// Loading states shaped like the pages they stand in for, so nothing jumps when data arrives.

export function IndexTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-7 w-40" />
      <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="flex gap-2 border-b p-3">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="border-b p-3">
          <Skeleton className="h-8 w-full max-w-sm" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-7 w-56" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
