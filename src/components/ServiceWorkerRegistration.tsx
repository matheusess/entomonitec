"use client";

import { useEffect, useState } from "react";
import type { Serwist } from "@serwist/window";

declare global {
  interface Window {
    serwist: Serwist;
  }
}

/**
 * Registra o Service Worker e lida com atualizações disponíveis.
 * Montado globalmente via providers.tsx — sem renderização visual.
 */
export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      window.serwist === undefined
    ) {
      return;
    }

    const sw = window.serwist;

    sw.addEventListener("waiting", () => {
      setUpdateAvailable(true);
    });

    sw.register();
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-green-700 px-4 py-3 text-white shadow-lg text-sm"
      role="alert"
    >
      <span>Nova versão disponível!</span>
      <button
        className="rounded bg-white px-3 py-1 text-green-800 font-medium hover:bg-green-50 transition-colors"
        onClick={() => {
          if (window.serwist) {
            window.serwist.messageSkipWaiting();
          }
          setUpdateAvailable(false);
          window.location.reload();
        }}
      >
        Atualizar
      </button>
    </div>
  );
}
