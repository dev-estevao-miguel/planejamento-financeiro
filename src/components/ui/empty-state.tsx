import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-pretty text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
