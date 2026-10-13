import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioLogado } from "@/infra/sessao";
import { listarCategoriasAtivas } from "@/modules/categorias/categorias.actions";
import { obterItemDaUt } from "@/modules/itens/itens.actions";

import { AjusteQuantidade } from "../../ajuste-quantidade";
import { ArquivamentoItem } from "../../arquivamento-item";
import { FormularioItem } from "../../formulario-item";

export const metadata: Metadata = { title: "Editar item" };

export default async function PaginaEditarItem({ params }: PageProps<"/meus-itens/[id]/editar">) {
  const { id } = await params;

  // Só o almoxarife edita (SPEC §2). A autorização de verdade é feita pelo service.
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.papel !== "almoxarife") notFound();

  const [item, categorias] = await Promise.all([obterItemDaUt(id), listarCategoriasAtivas()]);
  // Item inexistente ou de outra UT: não revela a diferença.
  if (!item.ok) notFound();
  if (!categorias.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {categorias.erro}
      </p>
    );
  }

  // A categoria atual do item pode estar desativada: continua selecionável nesta tela.
  const lista = categorias.dados.some((c) => c.id === item.dados.categoria.id)
    ? categorias.dados
    : [...categorias.dados, item.dados.categoria];

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
        <FormularioItem categorias={lista} item={item.dados} />
        <ArquivamentoItem itemId={item.dados.id} status={item.dados.status} />
      </div>
    </div>
  );
}
