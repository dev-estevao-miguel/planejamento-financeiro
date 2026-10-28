import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { can, getAppContext } from "@/features/auth/session";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { emptyTransactionValues, formChoices, valuesFromTransaction } from "@/features/transactions/form-defaults";
import { KIND_LABELS, TRANSACTION_KINDS, type TransactionKind } from "@/features/transactions/labels";
import { getFinanceOptions, getTransaction } from "@/features/transactions/queries";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Nova movimentação" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewTransactionPage({ searchParams }: PageProps<"/movimentacoes/nova">) {
  const [{ household }, params] = await Promise.all([getAppContext(), searchParams]);
  if (!household || !can(household, "finance.create")) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="Sem permissão para registrar"
          description="Seu papel na família permite apenas visualizar as movimentações."
        />
      </Card>
    );
  }

  const today = todayIn(household.timeZone);
  const kind = TRANSACTION_KINDS.includes(params.tipo as TransactionKind) ? (params.tipo as TransactionKind) : "expense";
  const duplicateId = typeof params.duplicar === "string" && UUID.test(params.duplicar) ? params.duplicar : null;

  const [options, source] = await Promise.all([
    getFinanceOptions(household.id),
    duplicateId ? getTransaction(household.id, duplicateId) : Promise.resolve(null),
  ]);
  const defaults = source
    ? valuesFromTransaction(source, "duplicate", today)
    : emptyTransactionValues(kind, today, household.memberId);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title={source ? "Duplicar movimentação" : KIND_LABELS[defaults.kind as TransactionKind].new}
        description={source ? "Confira os dados e salve como uma nova movimentação." : "Leva poucos segundos."}
      />
      <Card className="p-5">
        <TransactionForm mode="create" defaults={defaults} cancelHref="/movimentacoes" {...formChoices(options, defaults)} />
      </Card>
    </div>
  );
}
