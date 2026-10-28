"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { saveTransactionAction, type TransactionFormState } from "../actions";
import { KIND_LABELS, KIND_TONE, STATUS_LABELS, TRANSACTION_KINDS, type TransactionKind } from "../labels";
import type { CategoryOption, MemberOption, PaymentMethodOption } from "../queries";
import { MAX_INSTALLMENTS, type TransactionFormValues } from "../schemas";

interface TransactionFormProps {
  mode: "create" | "edit";
  defaults: TransactionFormValues;
  categories: CategoryOption[];
  members: MemberOption[];
  paymentMethods: PaymentMethodOption[];
  cancelHref: string;
}

const INITIAL_STATE: TransactionFormState = { status: "idle" };

/** Two or three mutually exclusive choices drawn as one segmented control. */
function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: { value: T; label: string; tone?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-[var(--radius-control)] bg-surface-muted p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex h-10 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-4px)] px-2 text-sm font-medium transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40",
              value === option.value ? cn("bg-surface shadow-sm", option.tone) : "text-muted-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TransactionForm({ mode, defaults, categories, members, paymentMethods, cancelHref }: TransactionFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveTransactionAction, INITIAL_STATE);
  const values = state.values ?? defaults;
  const errors = state.fieldErrors ?? {};

  const [kind, setKind] = useState<TransactionKind>(values.kind as TransactionKind);
  const [status, setStatus] = useState<"paid" | "pending">(values.status === "pending" ? "pending" : "paid");
  const [repeatMonthly, setRepeatMonthly] = useState(values.repeatMonthly);

  useEffect(() => {
    if (state.status !== "saved") return;
    toast.success(state.message);
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [state, router]);

  const kindCategories = categories.filter((category) => category.kind === kind);
  const parents = kindCategories.filter((category) => category.parentId === null);
  const statusLabels = STATUS_LABELS[kind];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
      <input type="hidden" name="id" value={values.id} />

      <Segmented
        name="kind"
        legend="Tipo"
        value={kind}
        onChange={setKind}
        options={TRANSACTION_KINDS.map((value) => ({ value, label: KIND_LABELS[value].singular, tone: KIND_TONE[value] }))}
      />

      <Field id="amount" label="Valor" error={errors.amount}>
        {(describedBy) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-muted-foreground">
              R$
            </span>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              required
              autoFocus={mode === "create"}
              defaultValue={values.amount}
              aria-describedby={describedBy}
              aria-invalid={errors.amount ? true : undefined}
              className="h-14 pl-12 text-2xl font-semibold tabular-nums"
            />
          </div>
        )}
      </Field>

      <Field id="description" label="Descrição" error={errors.description}>
        {(describedBy) => (
          <Input
            id="description"
            name="description"
            required
            maxLength={140}
            autoComplete="off"
            placeholder={kind === "income" ? "Ex.: Salário" : kind === "investment" ? "Ex.: Tesouro Selic" : "Ex.: Supermercado"}
            defaultValue={values.description}
            aria-describedby={describedBy}
            aria-invalid={errors.description ? true : undefined}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="occurredOn" label="Data" error={errors.occurredOn}>
          {(describedBy) => (
            <Input
              id="occurredOn"
              name="occurredOn"
              type="date"
              required
              defaultValue={values.occurredOn}
              aria-describedby={describedBy}
              aria-invalid={errors.occurredOn ? true : undefined}
            />
          )}
        </Field>

        <Field id="categoryId" label="Categoria" error={errors.categoryId}>
          {(describedBy) => (
            <Select
              // Remount when the kind changes: categories of another kind are not valid.
              key={kind}
              id="categoryId"
              name="categoryId"
              defaultValue={kind === values.kind ? values.categoryId : ""}
              aria-describedby={describedBy}
            >
              <option value="">Sem categoria</option>
              {parents.map((parent) => {
                const children = kindCategories.filter((category) => category.parentId === parent.id);
                return children.length === 0 ? (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ) : (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name} (geral)</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          )}
        </Field>

        <Field id="memberId" label="Responsável" error={errors.memberId}>
          {(describedBy) => (
            <Select id="memberId" name="memberId" defaultValue={values.memberId} aria-describedby={describedBy}>
              <option value="">Família</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field id="paymentMethodId" label="Forma de pagamento" error={errors.paymentMethodId}>
          {(describedBy) => (
            <Select
              id="paymentMethodId"
              name="paymentMethodId"
              defaultValue={values.paymentMethodId}
              aria-describedby={describedBy}
            >
              <option value="">Não informada</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Segmented
        name="status"
        legend="Situação"
        value={status}
        onChange={setStatus}
        options={[
          { value: "paid", label: statusLabels.paid },
          { value: "pending", label: statusLabels.pending },
        ]}
      />

      <details
        className="group rounded-[var(--radius-control)] border border-border"
        open={Boolean(values.notes || values.isPrivate || values.repeatMonthly || values.installments !== "1")}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Mais opções
          <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
          {mode === "create" ? (
            <>
              <Field
                id="installments"
                label="Parcelas"
                hint="O valor informado é o total da compra, dividido mês a mês."
                error={errors.installments}
              >
                {(describedBy) => (
                  <Input
                    id="installments"
                    name="installments"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_INSTALLMENTS}
                    defaultValue={values.installments}
                    disabled={repeatMonthly}
                    aria-describedby={describedBy}
                    aria-invalid={errors.installments ? true : undefined}
                  />
                )}
              </Field>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="repeatMonthly"
                  checked={repeatMonthly}
                  onChange={(event) => setRepeatMonthly(event.target.checked)}
                  className="size-5 accent-[var(--primary)]"
                />
                Repetir todo mês (salário, aluguel, assinaturas…)
              </label>

              {repeatMonthly ? (
                <Field id="repeatUntil" label="Repetir até (opcional)" error={errors.repeatUntil}>
                  {(describedBy) => (
                    <Input
                      id="repeatUntil"
                      name="repeatUntil"
                      type="date"
                      defaultValue={values.repeatUntil}
                      aria-describedby={describedBy}
                      aria-invalid={errors.repeatUntil ? true : undefined}
                    />
                  )}
                </Field>
              ) : null}
            </>
          ) : (
            <input type="hidden" name="installments" value="1" />
          )}

          <Field id="notes" label="Observações" error={errors.notes}>
            {(describedBy) => (
              <Textarea
                id="notes"
                name="notes"
                maxLength={1000}
                rows={3}
                defaultValue={values.notes}
                aria-describedby={describedBy}
              />
            )}
          </Field>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="isPrivate"
              defaultChecked={values.isPrivate}
              disabled={repeatMonthly}
              className="mt-0.5 size-5 accent-[var(--primary)]"
            />
            <span>
              Privada
              <span className="block text-muted-foreground">Só você vê esta movimentação.</span>
            </span>
          </label>
        </div>
      </details>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "sm:w-32" })}>
          Cancelar
        </Link>
        <SubmitButton className="sm:w-40" pendingLabel="Salvando…">
          {mode === "create" ? "Salvar" : "Salvar alterações"}
        </SubmitButton>
      </div>
    </form>
  );
}
