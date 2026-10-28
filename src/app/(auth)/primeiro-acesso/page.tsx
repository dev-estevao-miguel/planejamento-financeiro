import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivationForm } from "@/features/auth/components/activation-form";
import { AuthFormSkeleton } from "@/features/auth/components/auth-form-skeleton";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function FirstAccessPage({ searchParams }: PageProps<"/primeiro-acesso">) {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Primeiro acesso</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Confirme sua identidade com o código de acesso para criar ou redefinir sua senha.
        </p>
      </header>
      <Suspense fallback={<AuthFormSkeleton />}>
        <ActivationForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}
