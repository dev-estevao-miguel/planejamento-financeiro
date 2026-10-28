"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Toasts that follow the app theme (which may differ from the OS theme). */
export function AppToaster() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as const);
  return (
    <Toaster
      theme={theme}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ className: "font-sans" }}
      containerAriaLabel="Notificações"
    />
  );
}
