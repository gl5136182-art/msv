"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { sair } from "@/modules/usuarios/usuarios.actions";

// Na troca obrigatória o usuário não tem o menu do avatar: precisa de um jeito de sair
// (ex.: celular compartilhado).
export function BotaoSair() {
  const router = useRouter();
  const [saindo, iniciarSaida] = useTransition();

  return (
    <button
      type="button"
      disabled={saindo}
      onClick={() =>
        iniciarSaida(async () => {
          await sair();
          router.replace("/login");
          router.refresh();
        })
      }
      className="underline underline-offset-4 hover:text-laranja-145 disabled:opacity-50"
    >
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
