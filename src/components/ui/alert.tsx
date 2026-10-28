import { CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AlertProps {
  tone?: "error" | "info";
  children: ReactNode;
  className?: string;
}

/** Inline message announced to screen readers; icon + text, never color alone. */
export function Alert({ tone = "error", children, className }: AlertProps) {
  const Icon = tone === "error" ? CircleAlert : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-control)] px-3.5 py-3 text-sm",
        tone === "error" ? "bg-expense-soft text-expense" : "bg-primary-soft text-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
