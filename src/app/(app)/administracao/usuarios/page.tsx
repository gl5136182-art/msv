import type { Metadata } from "next";

import { obterUsuarioLogado } from "@/infra/sessao";
import { listarUtsAtivas } from "@/modules/uts/uts.actions";
import { listarUsuarios } from "@/modules/usuarios/usuarios.actions";

import { GerenciadorUsuarios } from "./gerenciador-usuarios";

export const metadata: Metadata = { title: "Usuários · Administração" };

export default async function PaginaUsuarios({ searchParams }: PageProps<"/administracao/usuarios">) {
  const parametros = await searchParams;
  const q = typeof parametros.q === "string" ? parametros.q : "";

  const [usuarios, uts, eu] = await Promise.all([
    listarUsuarios({ busca: q }),
    listarUtsAtivas(),
    obterUsuarioLogado(),
  ]);

  if (!usuarios.ok || !uts.ok) {
    const erro = !usuarios.ok ? usuarios.erro : !uts.ok ? uts.erro : "";
    return (
      <p role="alert" className="text-sm text-destructive">
        {erro}
      </p>
    );
  }

  return <GerenciadorUsuarios usuarios={usuarios.dados} uts={uts.dados} busca={q} meuId={eu?.id ?? null} />;
}
