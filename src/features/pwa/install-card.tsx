"use client";

import { CircleCheck, Download, Share } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { clearInstallPrompt, getInstallPrompt, isStandalone, subscribeInstallPrompt } from "./install-store";

type Platform = "installed" | "ios" | "other";

const subscribeNever = () => () => {};

function detectPlatform(): Platform {
  if (isStandalone()) return "installed";
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS ? "ios" : "other";
}

/** Install help: native prompt where supported, instructions elsewhere (iOS). */
export function InstallCard() {
  const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  // The platform never changes during a visit; null on the server.
  const platform = useSyncExternalStore<Platform | null>(subscribeNever, detectPlatform, () => null);

  if (platform === null) return null;

  if (platform === "installed") {
    return (
      <p className="flex items-center gap-2 text-sm text-income">
        <CircleCheck className="size-4" aria-hidden /> O aplicativo já está instalado neste dispositivo.
      </p>
    );
  }

  if (installPrompt) {
    return (
      <Button
        variant="secondary"
        className="w-full"
        onClick={async () => {
          await installPrompt.prompt();
          await installPrompt.userChoice;
          clearInstallPrompt();
        }}
      >
        <Download className="size-4" aria-hidden /> Instalar aplicativo
      </Button>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {platform === "ios" ? (
        <>
          No Safari, toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> e depois em{" "}
          <strong className="font-medium text-foreground">Adicionar à Tela de Início</strong>.
        </>
      ) : (
        <>
          Abra o menu do navegador e escolha <strong className="font-medium text-foreground">Instalar aplicativo</strong>.
          A instalação exige HTTPS (disponível no endereço publicado).
        </>
      )}
    </p>
  );
}
