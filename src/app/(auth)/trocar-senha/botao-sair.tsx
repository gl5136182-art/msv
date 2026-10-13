"use client";

import { useState } from "react";

import { sair } from "@/modules/usuarios/usuarios.actions";

// Na troca obrigatória o usuário não tem o menu do avatar: precisa de um jeito de sair
// (ex.: celular compartilhado).
export function BotaoSair() {
  const [saindo, setSaindo] = useState(false);

  // Recarregamento completo, não `router.replace`: o Next preserva o estado das páginas já
  // visitadas (`cacheComponents`), e o /login reapareceria com as credenciais do usuário anterior.
  async function aoSair() {
    setSaindo(true);
    await sair();
    window.location.replace("/login");
  }

  return (
    <button
      type="button"
      disabled={saindo}
      onClick={aoSair}
      className="underline underline-offset-4 hover:text-laranja-145 disabled:opacity-50"
    >
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
