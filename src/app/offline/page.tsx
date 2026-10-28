import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão" };

/** Served by the service worker when a page cannot be loaded offline. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <LogoMark className="size-12" />
      <div className="flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Você está offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível carregar esta página. Para não mostrar valores desatualizados, os dados financeiros só
          aparecem com conexão.
        </p>
      </div>
      <RetryButton />
    </main>
  );
}
