import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioLogado } from "@/infra/sessao";
import { temPapel } from "@/lib/usuario-logado";
import { obterFormularioRequisicao } from "@/modules/requisicoes/requisicoes.actions";

import { FormularioRequisicao } from "../../formulario-requisicao";

export const metadata: Metadata = { title: "Editar requisição" };

export const maxDuration = 120;

export default async function PaginaEditarRequisicao({ params }: PageProps<"/requisicoes/[id]/editar">) {
  const { id } = await params;
  const usuario = await obterUsuarioLogado();
  if (!usuario || !temPapel(usuario.papel, "colaborador", "almoxarife")) notFound();

  const formulario = await obterFormularioRequisicao({ id });
  // Inexistente, de outra pessoa ou já aberta: só o rascunho do próprio solicitante é editável.
  if (!formulario.ok || !formulario.dados.rascunho) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CabecalhoPagina titulo={`Editar ${formulario.dados.rascunho.codigo}`} />
      <FormularioRequisicao {...formulario.dados} />
    </div>
  );
}
