import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFormSkeleton } from "@/features/auth/components/auth-form-skeleton";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Acesse as finanças da sua família.</p>
      </header>
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}
