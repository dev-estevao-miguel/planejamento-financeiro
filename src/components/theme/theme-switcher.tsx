"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { applyThemePreference, readThemePreference, subscribeThemePreference, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

export function ThemeSwitcher() {
  // null on the server: the stored preference only exists in the browser.
  const preference = useSyncExternalStore<ThemePreference | null>(
    subscribeThemePreference,
    readThemePreference,
    () => null,
  );

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-surface-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => applyThemePreference(value)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-[calc(var(--radius-control)-4px)] text-sm font-medium transition-colors",
              selected ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
