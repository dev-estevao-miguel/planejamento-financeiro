import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: string;
  /** Secondary line, e.g. "R$ 4.500,00 já recebido". */
  detail?: ReactNode;
  /** Small identity mark beside the label (the value itself stays in text ink). */
  marker?: string;
  className?: string;
}

/** Stat tile: label · value · detail. Values use proportional figures at display size. */
export function StatTile({ label, value, detail, marker, className }: StatTileProps) {
  return (
    <Card className={cn("flex flex-col gap-1 p-4", className)}>
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {marker ? <span aria-hidden className={cn("size-2 rounded-full", marker)} /> : null}
        {label}
      </p>
      <p className="text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </Card>
  );
}
