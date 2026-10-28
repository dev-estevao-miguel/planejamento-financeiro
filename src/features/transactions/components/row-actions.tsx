"use client";

import { CircleCheck, Clock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { deleteTransactionAction, restoreTransactionAction, setTransactionStatusAction } from "../actions";

/** One-tap "paid" / "pending" switch on a list row. */
export function StatusToggle({ id, status, paidLabel }: { id: string; status: "paid" | "pending"; paidLabel: string }) {
  const [pending, startTransition] = useTransition();
  const next = status === "paid" ? "pending" : "paid";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setTransactionStatusAction(id, next);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
      aria-label={status === "paid" ? "Marcar como pendente" : `Marcar como ${paidLabel.toLowerCase()}`}
      title={status === "paid" ? "Marcar como pendente" : `Marcar como ${paidLabel.toLowerCase()}`}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        status === "paid" ? "text-income hover:bg-income-soft" : "text-warning hover:bg-warning-soft",
      )}
    >
      {status === "paid" ? <CircleCheck className="size-5" aria-hidden /> : <Clock className="size-5" aria-hidden />}
    </button>
  );
}

/** Two-step delete (soft) with "Desfazer" in the toast. */
export function DeleteTransactionButton({ id, redirectTo }: { id: string; redirectTo: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" className="text-expense" onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" aria-hidden /> Excluir
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Confirmar exclusão">
      <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
        Manter
      </Button>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteTransactionAction(id);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(result.message, {
              action: {
                label: "Desfazer",
                onClick: async () => {
                  const restored = await restoreTransactionAction(id);
                  if (restored.ok) toast.success(restored.message);
                  else toast.error(restored.message);
                  router.refresh();
                },
              },
            });
            router.replace(redirectTo);
          })
        }
      >
        <Trash2 className="size-4" aria-hidden /> Confirmar exclusão
      </Button>
    </div>
  );
}
