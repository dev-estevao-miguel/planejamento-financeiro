import { cn } from "@/lib/cn";

const COINS = [0, 1, 2];

/**
 * Small "coins being counted" animation. CSS only; with reduced motion the
 * coins simply appear stacked. Use for short waits (sign-in), skeletons for
 * page content.
 */
export function CoinLoader({ label = "Carregando…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative flex h-14 w-10 flex-col-reverse items-center" aria-hidden>
        {COINS.map((index) => (
          <span
            key={index}
            className="-mt-1.5 h-3.5 w-10 animate-coin-drop rounded-[50%] border border-amber-600/40 bg-linear-to-b from-amber-300 to-amber-500 shadow-sm"
            style={{ animationDelay: `${index * 180}ms` }}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
