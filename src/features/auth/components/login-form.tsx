"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { CoinLoader } from "@/components/brand/coin-loader";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "../actions";
import { INITIAL_AUTH_STATE } from "../messages";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export function LoginForm({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = use(searchParams);
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_AUTH_STATE);

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
              enterKeyHint="next"
              defaultValue={state.username ?? single(params.usuario)}
              aria-describedby={describedBy}
              aria-invalid={state.status === "error" || undefined}
            />
          )}
        </Field>

        <Field id="password" label="Senha" hint="Primeiro acesso? Deixe a senha em branco e toque em Entrar.">
          {(describedBy) => (
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="go"
              aria-describedby={describedBy}
              aria-invalid={state.status === "error" || undefined}
            />
          )}
        </Field>

        <input type="hidden" name="next" value={single(params.next)} />

        <SubmitButton size="lg" className="mt-1 w-full" pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Esqueceu a senha?{" "}
        <Link href="/primeiro-acesso" className="font-medium text-primary underline-offset-4 hover:underline">
          Use um código de acesso
        </Link>
      </p>

      {pending ? (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-background/80 backdrop-blur-sm">
          <CoinLoader label="Entrando…" />
        </div>
      ) : null}
    </>
  );
}
