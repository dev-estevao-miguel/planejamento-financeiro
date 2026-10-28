import { Skeleton } from "@/components/ui/skeleton";

/** Same footprint as the auth forms, so nothing shifts when they appear. */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full rounded-[var(--radius-control)]" />
        </div>
      ))}
      <Skeleton className="mt-1 h-12 w-full rounded-[var(--radius-control)]" />
    </div>
  );
}
