import { Skeleton } from "@/components/ui/skeleton";

/** Generic page placeholder matching the page header + card layout. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-[var(--radius-card)]" />
        <Skeleton className="h-28 rounded-[var(--radius-card)]" />
        <Skeleton className="h-28 rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-64 rounded-[var(--radius-card)]" />
    </div>
  );
}
