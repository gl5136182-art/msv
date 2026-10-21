import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioLogado } from "@/infra/sessao";
import { temPapel } from "@/lib/usuario-logado";
import { obterItemDaUt } from "@/modules/itens/itens.actions";

import { AjusteQuantidade } from "../../ajuste-quantidade";
import { ArquivamentoItem } from "../../arquivamento-item";
import { FormularioItem } from "../../formulario-item";

export const metadata: Metadata = { title: "Editar item" };

export default async function PaginaEditarItem({ params }: PageProps<"/meus-itens/[id]/editar">) {
  const { id } = await params;

  // Só o almoxarife edita (SPEC §2). A autorização de verdade é feita pelo service.
  const usuario = await obterUsuarioLogado();
  if (!usuario || !temPapel(usuario.papel, "almoxarife")) notFound();

  const item = await obterItemDaUt(id);
  // Item inexistente ou de outra UT: não revela a diferença.
  if (!item.ok) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CabecalhoPagina titulo="Editar item" />
      <div className="flex flex-col gap-4">
        <AjusteQuantidade
          itemId={item.dados.id}
          quantidadeDisponivel={item.dados.quantidadeDisponivel}
          quantidadeTotal={item.dados.quantidadeTotal}
          unidade={item.dados.unidade}
          status={item.dados.status}
        />
        <FormularioItem item={item.dados} />
        <ArquivamentoItem itemId={item.dados.id} status={item.dados.status} />
      </div>
    </div>
  );
}
