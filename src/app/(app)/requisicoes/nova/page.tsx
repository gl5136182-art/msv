import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioLogado } from "@/infra/sessao";
import { temPapel } from "@/lib/usuario-logado";
import { obterFormularioRequisicao } from "@/modules/requisicoes/requisicoes.actions";

import { FormularioRequisicao } from "../formulario-requisicao";

export const metadata: Metadata = { title: "Nova requisição" };

// Abrir a requisição já analisa a vitrine com a IA (duas chamadas ao provedor).
export const maxDuration = 120;

export default async function PaginaNovaRequisicao() {
  const usuario = await obterUsuarioLogado();
  if (!usuario || !temPapel(usuario.papel, "colaborador", "almoxarife")) notFound();

  const formulario = await obterFormularioRequisicao();
  if (!formulario.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {formulario.erro}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CabecalhoPagina titulo="Nova requisição" />
      <FormularioRequisicao {...formulario.dados} />
    </div>
  );
}
