import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ArrowLeftRight, Plus, Search, Users } from "lucide-react";
import { MonthSwitcher } from "@/components/shell/month-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { can, getAppContext } from "@/features/auth/session";
import { summarizePeriod } from "@/features/finance/calculations";
import { StatTile } from "@/features/finance/components/stat-tile";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { KIND_LABELS, TRANSACTION_KINDS, type TransactionKind } from "@/features/transactions/labels";
import {
  ensureRecurringTransactions,
  getFinanceOptions,
  getTransactionsInRange,
  listTransactions,
  TRANSACTIONS_PAGE_SIZE,
} from "@/features/transactions/queries";
import { parseMonthParam, toMonthParam, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Movimentações" };

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TransactionsPage({ searchParams }: PageProps<"/movimentacoes">) {
  const [{ household }, params] = await Promise.all([getAppContext(), searchParams]);
  if (!household) {
    return (
      <Card>
        <EmptyState icon={Users} title="Nenhuma família vinculada" description="Peça ao responsável para adicionar você." />
      </Card>
    );
  }

  const today = todayIn(household.timeZone);
  const month = parseMonthParam(single(params.mes), today);
  const kindParam = single(params.tipo);
  const kind = TRANSACTION_KINDS.includes(kindParam as TransactionKind) ? (kindParam as TransactionKind) : undefined;
  const statusParam = single(params.situacao);
  const status = statusParam === "paid" || statusParam === "pending" ? statusParam : undefined;
  const memberParam = single(params.pessoa);
  const memberId = memberParam && UUID.test(memberParam) ? memberParam : undefined;
  const categoryParam = single(params.categoria);
  const search = single(params.busca)?.slice(0, 80);
  const page = Math.max(1, Math.min(1000, Number.parseInt(single(params.pagina) ?? "1", 10) || 1));

  await ensureRecurringTransactions(household.id);
  const options = await getFinanceOptions(household.id);
  const category = categoryParam ? options.categories.find((item) => item.id === categoryParam) : undefined;
  const categoryIds = category
    ? [category.id, ...options.categories.filter((item) => item.parentId === category.id).map((item) => item.id)]
    : undefined;

  const [{ items, total }, monthItems] = await Promise.all([
    listTransactions(household.id, { month, kind, status, memberId, categoryIds, search, page }),
    getTransactionsInRange(household.id, { from: month, to: month }),
  ]);
  const summary = summarizePeriod(monthItems);
  const filtered = Boolean(kind || status || memberId || category || search);
  const pages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));
  const keep = {
    tipo: kind,
    situacao: status,
    pessoa: memberId,
    categoria: category?.id,
    busca: search,
  };
  const pageHref = (target: number) => {
    const query = new URLSearchParams({ mes: toMonthParam(month), pagina: String(target) });
    for (const [key, value] of Object.entries(keep)) if (value) query.set(key, value);
    return `/movimentacoes?${query.toString()}`;
  };
  const canCreate = can(household, "finance.create");

  return (
    <>
      <PageHeader
        title="Movimentações"
        description="Receitas, despesas e investimentos da família."
        action={
          canCreate ? (
            <Link href="/movimentacoes/nova" className={buttonClasses({ className: "hidden lg:inline-flex" })}>
              <Plus className="size-4" aria-hidden /> Nova movimentação
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-5">
        <MonthSwitcher month={month} basePath="/movimentacoes" params={keep} className="self-center sm:self-start" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Receitas" marker="bg-income" value={formatMoney(summary.incomeCents)} />
          <StatTile label="Despesas" marker="bg-expense" value={formatMoney(summary.expenseCents)} />
          <StatTile label="Investimentos" marker="bg-investment" value={formatMoney(summary.investmentCents)} />
          <StatTile label="Saldo do mês" value={formatMoney(summary.balanceCents)} detail="Receitas − despesas − investimentos" />
        </div>

        <Form action="/movimentacoes" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <input type="hidden" name="mes" value={toMonthParam(month)} />
          <label className="relative flex-1 sm:min-w-56">
            <span className="sr-only">Buscar pela descrição</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="busca" type="search" placeholder="Buscar…" defaultValue={search} className="pl-10" />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <label>
              <span className="sr-only">Tipo</span>
              <Select name="tipo" defaultValue={kind ?? ""} className="sm:w-40">
                <option value="">Todos os tipos</option>
                {TRANSACTION_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {KIND_LABELS[value].plural}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">Situação</span>
              <Select name="situacao" defaultValue={status ?? ""} className="sm:w-40">
                <option value="">Todas as situações</option>
                <option value="paid">Pagas/recebidas</option>
                <option value="pending">Pendentes</option>
              </Select>
            </label>
            <label>
              <span className="sr-only">Pessoa</span>
              <Select name="pessoa" defaultValue={memberId ?? ""} className="sm:w-40">
                <option value="">Todas as pessoas</option>
                {options.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">Categoria</span>
              <Select name="categoria" defaultValue={category?.id ?? ""} className="sm:w-48">
                <option value="">Todas as categorias</option>
                {options.categories
                  .filter((item) => item.parentId === null && !item.archived)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClasses({ variant: "secondary" })}>
              Filtrar
            </button>
            {filtered ? (
              <Link href={`/movimentacoes?mes=${toMonthParam(month)}`} className={buttonClasses({ variant: "ghost" })}>
                Limpar
              </Link>
            ) : null}
          </div>
        </Form>

        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={ArrowLeftRight}
              title={filtered ? "Nada encontrado com esses filtros" : "Nenhuma movimentação neste mês"}
              description={
                filtered
                  ? "Tente outra busca ou limpe os filtros."
                  : "Registre gastos e receitas em poucos segundos. Tudo o que um membro adiciona aparece para a família."
              }
              action={
                canCreate && !filtered ? (
                  <Link href="/movimentacoes/nova" className={buttonClasses()}>
                    <Plus className="size-4" aria-hidden /> Adicionar movimentação
                  </Link>
                ) : null
              }
            />
          </Card>
        ) : (
          <>
            <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
              {total} {total === 1 ? "movimentação" : "movimentações"}
              {filtered ? " encontradas" : ""}
            </p>
            <TransactionList items={items} options={options} today={today} canEdit={can(household, "finance.edit")} />
            {pages > 1 ? (
              <nav aria-label="Paginação" className="flex items-center justify-center gap-3">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary" })}>
                    Anterior
                  </Link>
                ) : null}
                <span className="text-sm text-muted-foreground tabular-nums">
                  Página {page} de {pages}
                </span>
                {page < pages ? (
                  <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary" })}>
                    Próxima
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
