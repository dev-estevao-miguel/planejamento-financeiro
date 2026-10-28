"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { captureInstallPrompt, clearInstallPrompt } from "./install-store";

/**
 * Registers /sw.js (production only, so dev never serves stale bundles),
 * announces new versions and captures the install prompt.
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A worker left over from a production test would cache dev assets.
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      return;
    }

    // On the very first visit the new worker claims the page; that is not an
    // update and must not reload. Only a replaced controller means "new version".
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptUpdate = (worker: ServiceWorker) => {
      toast.info("Nova versão disponível", {
        description: "Atualize para usar a versão mais recente.",
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => worker.postMessage("SKIP_WAITING") },
      });
    };

    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      // Only an update if a previous worker already controls the page.
      if (registration.waiting && navigator.serviceWorker.controller) promptUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) promptUpdate(installing);
        });
      });
    });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
