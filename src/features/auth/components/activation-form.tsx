"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { use, useActionState } from "react";
import { CoinLoader } from "@/components/brand/coin-loader";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { activationAction } from "../actions";
import { formatActivationCode } from "../activation-code";
import { INITIAL_AUTH_STATE } from "../messages";
import { PASSWORD_MIN_LENGTH } from "../schemas";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Step 1: username + activation code. Step 2: create the password.
 * The server re-checks the code on the final step; nothing is trusted from
 * the client between steps.
 */
export function ActivationForm({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = use(searchParams);
  const [state, formAction, pending] = useActionState(activationAction, INITIAL_AUTH_STATE);
  const initialUsername = typeof params.usuario === "string" ? params.usuario : "";

  if (state.status === "code_verified") {
    return (
      <form action={formAction} noValidate className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-income-soft px-3.5 py-3 text-sm text-income">
          <KeyRound className="size-4 shrink-0" aria-hidden />
          Código confirmado. Agora crie sua senha.
        </div>

        <input type="hidden" name="intent" value="complete" />
        <input type="hidden" name="username" value={state.username ?? ""} />
        <input type="hidden" name="code" value={state.code ?? ""} />

        <Field
          id="password"
          label="Nova senha"
          hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`}
          error={state.fieldErrors?.password}
        >
          {(describedBy) => (
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="new-password"
              autoFocus
              aria-describedby={describedBy}
              aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
            />
          )}
        </Field>

        <Field id="confirmPassword" label="Confirme a senha" error={state.fieldErrors?.confirmPassword}>
          {(describedBy) => (
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              autoComplete="new-password"
              aria-describedby={describedBy}
              aria-invalid={Boolean(state.fieldErrors?.confirmPassword) || undefined}
            />
          )}
        </Field>

        <SubmitButton size="lg" className="mt-1 w-full" pendingLabel="Salvando…">
          Criar senha e entrar
        </SubmitButton>

        {pending ? <PendingOverlay label="Preparando sua conta…" /> : null}
      </form>
    );
  }

  return (
    <>
      <form action={formAction} noValidate className="flex flex-col gap-5">
        {state.message ? <Alert>{state.message}</Alert> : null}

        <Field id="username" label="Usuário">
          {(describedBy) => (
            <Input
              id="username"
              name="username"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              defaultValue={state.username ?? initialUsername}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field
          id="code"
          label="Código de acesso"
          hint="Código de 8 caracteres enviado pelo responsável da família. Vale por 72 horas."
        >
          {(describedBy) => (
            <Input
              id="code"
              name="code"
              required
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              maxLength={9}
              defaultValue={state.code ? formatActivationCode(state.code) : ""}
              className="font-mono tracking-[0.2em] uppercase"
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <SubmitButton size="lg" className="mt-1 w-full" pendingLabel="Verificando…">
          Continuar
        </SubmitButton>
      </form>

      <Link
        href="/entrar"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para o login
      </Link>
    </>
  );
}

function PendingOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-background/80 backdrop-blur-sm">
      <CoinLoader label={label} />
    </div>
  );
}
