import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Placeholder with the final element's size, so the layout does not jump. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-shimmer rounded-lg bg-surface-muted", className)} {...props} />;
}
