"use client";

import { Copy } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CategoryIcon } from "@/features/transactions/components/category-icon";
import { formatAmountInput } from "@/features/transactions/format";
import { formatMoney, type Cents } from "@/lib/money";
import { copyPreviousBudgetAction, saveBudgetAction, type BudgetFormState } from "../actions";

export interface BudgetFormRow {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  plannedCents: Cents;
  spentCents: Cents;
}

const INITIAL_STATE: BudgetFormState = { status: "idle" };

export function BudgetForm({ month, rows, canCopy }: { month: string; rows: BudgetFormRow[]; canCopy: boolean }) {
  const [state, formAction] = useActionState(saveBudgetAction, INITIAL_STATE);
  const [copying, startCopy] = useTransition();

  useEffect(() => {
    if (state.status === "saved" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="month" value={month} />
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

      {canCopy ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={copying}
          onClick={() =>
            startCopy(async () => {
              const result = await copyPreviousBudgetAction(month);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
            })
          }
        >
          <Copy className="size-4" aria-hidden /> Copiar do mês anterior
        </Button>
      ) : null}

      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const id = `planned-${row.categoryId}`;
          const error = state.fieldErrors?.[row.categoryId];
          return (
            <li key={row.categoryId} className="flex items-center gap-3 py-3">
              <CategoryIcon icon={row.icon} color={row.color} />
              <label htmlFor={id} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.spentCents > 0 ? `${formatMoney(row.spentCents)} no mês` : "Nada lançado no mês"}
                </span>
                {error ? <span className="block text-xs text-expense">{error}</span> : null}
              </label>
              <div className="relative w-36 shrink-0">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id={id}
                  name={`planned:${row.categoryId}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  defaultValue={row.plannedCents > 0 ? formatAmountInput(row.plannedCents) : ""}
                  aria-invalid={error ? true : undefined}
                  className="h-11 pl-9 text-right tabular-nums"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] flex justify-end lg:bottom-4">
        <SubmitButton className="shadow-[var(--shadow-float)]" pendingLabel="Salvando…">
          Salvar planejamento
        </SubmitButton>
      </div>
    </form>
  );
}
