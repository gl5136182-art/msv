"use client";

import { useEffect } from "react";

// Registra o service worker (public/sw.js) só em produção: em desenvolvimento ele ficaria
// servindo arquivos antigos. Não renderiza nada.
export function RegistrarSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem SW o app funciona igual (só não instala/cacheia assets): falha silenciosa.
    });
  }, []);

  return null;
}
