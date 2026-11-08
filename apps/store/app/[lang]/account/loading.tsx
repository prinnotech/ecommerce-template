import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
