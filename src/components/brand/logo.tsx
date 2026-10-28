import { cn } from "@/lib/cn";
import { BRAND_GRADIENT } from "@/lib/brand";

/**
 * Brand mark: three ascending bars on an indigo tile. The tile is CSS, not an
 * SVG gradient: a gradient <defs> id shared by several logos breaks when the
 * defining instance is hidden (e.g. the desktop sidebar on phones).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[28%]", className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${BRAND_GRADIENT.from}, ${BRAND_GRADIENT.to})` }}
    >
      <svg viewBox="0 0 32 32" className="size-full">
        <rect x="8" y="17" width="4" height="7" rx="2" fill="#fff" opacity="0.65" />
        <rect x="14" y="13" width="4" height="11" rx="2" fill="#fff" opacity="0.82" />
        <rect x="20" y="8" width="4" height="16" rx="2" fill="#fff" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  compact = false,
  onBrand = false,
}: {
  className?: string;
  compact?: boolean;
  /** On the brand gradient: white text and a translucent tile. */
  onBrand?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={onBrand ? "bg-white/15 [background-image:none]! ring-1 ring-white/25" : undefined} />
      {compact ? null : (
        <span className={cn("text-[15px] leading-tight font-semibold tracking-tight", onBrand && "text-white")}>
          Planejamento
          <span className={cn("block", onBrand ? "text-white/70" : "text-muted-foreground")}>Financeiro</span>
        </span>
      )}
    </span>
  );
}
