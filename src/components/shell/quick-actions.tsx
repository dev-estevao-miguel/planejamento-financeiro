"use client";

import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  Goal,
  Plus,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface QuickAction {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  /** Where the action leads; absent = not available yet ("Em breve"). */
  href?: string;
}

const ACTIONS: QuickAction[] = [
  {
    label: "Nova despesa",
    description: "Registrar um gasto",
    icon: CircleArrowUp,
    tone: "bg-expense-soft text-expense",
    href: "/movimentacoes/nova?tipo=expense",
  },
  {
    label: "Nova receita",
    description: "Salário, renda extra…",
    icon: CircleArrowDown,
    tone: "bg-income-soft text-income",
    href: "/movimentacoes/nova?tipo=income",
  },
  {
    label: "Novo investimento",
    description: "Aporte em um investimento",
    icon: TrendingUp,
    tone: "bg-investment-soft text-investment",
    href: "/movimentacoes/nova?tipo=investment",
  },
  { label: "Aporte em meta", description: "Guardar para um objetivo", icon: Goal, tone: "bg-primary-soft text-primary" },
  {
    label: "Transferência interna",
    description: "Entre contas da família",
    icon: ArrowLeftRight,
    tone: "bg-surface-muted text-muted-foreground",
  },
];

interface QuickActionsProps {
  /** "fab": floating "+" on phones; "button": full-width button in the sidebar. */
  variant: "fab" | "button";
  label?: string;
}

export function QuickActions({ variant, label = "Nova movimentação" }: QuickActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "fab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          aria-haspopup="dialog"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-2xl bg-primary-solid text-primary-solid-foreground shadow-[var(--shadow-float)] transition-transform active:scale-95 lg:hidden"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} aria-haspopup="dialog" className="w-full">
          <Plus className="size-4" aria-hidden /> {label}
        </Button>
      )}

      <BottomSheet open={open} onClose={() => setOpen(false)} title="O que você quer registrar?">
        <ul className="flex flex-col gap-1">
          {ACTIONS.map(({ label: actionLabel, description, icon: Icon, tone, href }) => (
            <li key={actionLabel}>
              <button
                type="button"
                disabled={!href}
                onClick={() => {
                  if (!href) return;
                  setOpen(false);
                  router.push(href);
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-surface-muted disabled:opacity-60"
              >
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{actionLabel}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
                {!href ? (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    Em breve
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
