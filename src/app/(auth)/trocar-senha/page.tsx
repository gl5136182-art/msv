import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { obterUsuarioLogado } from "@/infra/sessao";
import { SENHA_TAMANHO_MINIMO } from "@/modules/usuarios/usuarios.schemas";

import { BotaoSair } from "./botao-sair";
import { FormularioTrocarSenha } from "./formulario-trocar-senha";

export const metadata: Metadata = { title: "Trocar senha" };

// Duas entradas: obrigatória (primeiro acesso ou senha redefinida pelo admin, o proxy leva
// para cá) e voluntária (menu do avatar). Na obrigatória não há como voltar sem trocar,
// só sair. O que depende da sessão fica atrás de Suspense (cacheComponents).
export default function PaginaTrocarSenha() {
  return (
    <section className="rounded-md border border-border bg-card p-6">
      <h1 className="text-xl font-bold lg:text-2xl">Trocar senha</h1>

      <Suspense fallback={<p className="mt-2 h-5" aria-hidden />}>
        <Orientacao />
      </Suspense>

      <FormularioTrocarSenha />

      <Suspense fallback={null}>
        <Saida />
      </Suspense>
    </section>
  );
}

async function Orientacao() {
  const usuario = await obterUsuarioLogado();
  const obrigatoria = usuario?.deveTrocarSenha ?? false;

  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {obrigatoria
        ? "Defina uma nova senha para continuar."
        : `Use no mínimo ${SENHA_TAMANHO_MINIMO} caracteres, diferente da senha atual.`}
    </p>
  );
}

async function Saida() {
  const usuario = await obterUsuarioLogado();
  const obrigatoria = usuario?.deveTrocarSenha ?? false;

  return (
    <p className="mt-4 text-sm">
      {obrigatoria ? (
        <BotaoSair />
      ) : (
        <Link href="/" className="underline underline-offset-4 hover:text-laranja-145">
          Voltar
        </Link>
      )}
    </p>
  );
}
