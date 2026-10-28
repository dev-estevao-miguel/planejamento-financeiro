import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { can, getAppContext } from "@/features/auth/session";
import { DeleteTransactionButton } from "@/features/transactions/components/row-actions";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { formChoices, valuesFromTransaction } from "@/features/transactions/form-defaults";
import { KIND_LABELS } from "@/features/transactions/labels";
import { getFinanceOptions, getTransaction } from "@/features/transactions/queries";
import { formatDate, toMonthParam, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Editar movimentação" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditTransactionPage({ params }: PageProps<"/movimentacoes/[id]">) {
  const [{ household }, { id }] = await Promise.all([getAppContext(), params]);
  if (!household || !UUID.test(id)) notFound();

  const [options, item] = await Promise.all([getFinanceOptions(household.id), getTransaction(household.id, id)]);
  if (!item) notFound();

  const today = todayIn(household.timeZone);
  const defaults = valuesFromTransaction(item, "edit", today);
  const listHref = `/movimentacoes?mes=${toMonthParam(item.competenceMonth)}`;
  const canEdit = can(household, "finance.edit");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title={canEdit ? `Editar ${KIND_LABELS[item.kind].singular.toLowerCase()}` : KIND_LABELS[item.kind].singular}
        description={
          <>
            {formatDate(item.occurredOn)}
            {item.installmentTotal ? ` · parcela ${item.installmentNumber} de ${item.installmentTotal}` : ""}
            {item.recurringRuleId ? " · gerada por uma recorrência" : ""}
          </>
        }
      />
      <Card className="p-5">
        {canEdit ? (
          <TransactionForm mode="edit" defaults={defaults} cancelHref={listHref} {...formChoices(options, defaults)} />
        ) : (
          <p className="text-sm text-muted-foreground">Seu papel na família permite apenas visualizar esta movimentação.</p>
        )}
      </Card>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {can(household, "finance.create") ? (
          <Link href={`/movimentacoes/nova?duplicar=${item.id}`} className={buttonClasses({ variant: "ghost" })}>
            <Copy className="size-4" aria-hidden /> Duplicar
          </Link>
        ) : (
          <span />
        )}
        {can(household, "finance.delete") ? <DeleteTransactionButton id={item.id} redirectTo={listHref} /> : null}
      </div>
    </div>
  );
}
