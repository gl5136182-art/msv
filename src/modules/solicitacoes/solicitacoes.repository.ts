import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

import type { StatusSolicitacao } from "./solicitacoes.schemas";

export type SolicitacaoRegistro = Prisma.SolicitacaoGetPayload<Record<string, never>>;

const selecionarItemParaSolicitar = {
  id: true,
  nome: true,
  unidade: true,
  utId: true,
  status: true,
  quantidadeDisponivel: true,
  ut: { select: { ativo: true } },
} satisfies Prisma.ItemSelect;

/** O que o service precisa do item para validar um pedido (regras 5 e 6). */
export type ItemParaSolicitar = Prisma.ItemGetPayload<{ select: typeof selecionarItemParaSolicitar }>;

export function buscarItemParaSolicitar(id: string, cliente: ClienteDb = db): Promise<ItemParaSolicitar | null> {
  return cliente.item.findUnique({ where: { id }, select: selecionarItemParaSolicitar });
}

export type DadosNovaSolicitacao = {
  itemId: string;
  solicitanteId: string;
  utDestinoId: string;
  quantidade: number;
  observacao: string | null;
  status: StatusSolicitacao;
};

export function criar(dados: DadosNovaSolicitacao, cliente: ClienteDb = db): Promise<SolicitacaoRegistro> {
  return cliente.solicitacao.create({ data: dados });
}

const incluirItem = {
  item: {
    select: {
      id: true,
      nome: true,
      utId: true,
      status: true,
      quantidadeDisponivel: true,
      quantidadeTotal: true,
      valorUnitarioReposicao: true,
    },
  },
} satisfies Prisma.SolicitacaoInclude;

/** Solicitação com os dados do item de que o service precisa para responder (aceitar, recusar...). */
export type SolicitacaoComItem = Prisma.SolicitacaoGetPayload<{ include: typeof incluirItem }>;

export function buscarPorId(id: string, cliente: ClienteDb = db): Promise<SolicitacaoComItem | null> {
  return cliente.solicitacao.findUnique({ where: { id }, include: incluirItem });
}

export type DadosAceite = {
  respondidaPorId: string;
  respondidaEm: Date;
  /** Valor de reposição do item no momento do aceite (SPEC §3, regra 8). */
  valorUnitarioSnapshot: number;
};

/**
 * Marca como `aceita` só se ainda estiver `pendente` (update condicional: duas respostas
 * simultâneas não passam as duas). Devolve `false` quando outra resposta chegou antes.
 */
export async function aceitarSePendente(id: string, dados: DadosAceite, cliente: ClienteDb = db): Promise<boolean> {
  const { count } = await cliente.solicitacao.updateMany({
    where: { id, status: "pendente" },
    data: { status: "aceita", ...dados },
  });
  return count === 1;
}

/**
 * Recusa as solicitações `pendentes` do item, com o motivo, sem autor (recusa automática:
 * item esgotado ou arquivado). `excetoId` poupa a solicitação que está sendo aceita agora.
 * Devolve as solicitações recusadas, para o service notificar os solicitantes.
 */
export async function recusarPendentesDoItem(
  itemId: string,
  motivo: string,
  respondidaEm: Date,
  excetoId: string | null,
  cliente: ClienteDb = db,
): Promise<Array<{ id: string; solicitanteId: string }>> {
  const pendentes = await cliente.solicitacao.findMany({
    where: { itemId, status: "pendente", ...(excetoId ? { id: { not: excetoId } } : {}) },
    select: { id: true, solicitanteId: true },
  });
  if (pendentes.length === 0) return [];

  await cliente.solicitacao.updateMany({
    where: { id: { in: pendentes.map((p) => p.id) }, status: "pendente" },
    data: { status: "recusada", motivoRecusa: motivo, respondidaEm },
  });
  return pendentes;
}

/**
 * Debita a quantidade do item com update condicional (SPEC §3, regra 8): só se o item está
 * `disponivel` e ainda tem a quantidade. Devolve `false` se não deu (disputa perdida).
 */
export async function debitarQuantidade(itemId: string, quantidade: number, cliente: ClienteDb = db): Promise<boolean> {
  const { count } = await cliente.item.updateMany({
    where: { id: itemId, status: "disponivel", quantidadeDisponivel: { gte: quantidade } },
    data: { quantidadeDisponivel: { decrement: quantidade } },
  });
  return count === 1;
}

export async function quantidadeDisponivelDoItem(itemId: string, cliente: ClienteDb = db): Promise<number> {
  const item = await cliente.item.findUniqueOrThrow({ where: { id: itemId }, select: { quantidadeDisponivel: true } });
  return item.quantidadeDisponivel;
}

export function atualizarStatusDoItem(
  itemId: string,
  status: "disponivel" | "esgotado",
  cliente: ClienteDb = db,
): Promise<unknown> {
  return cliente.item.update({ where: { id: itemId }, data: { status } });
}

export type DadosRecusa = {
  motivoRecusa: string;
  respondidaPorId: string;
  respondidaEm: Date;
};

/** Marca como `recusada` só se ainda estiver `pendente`. Devolve `false` se outra resposta chegou antes. */
export async function recusarSePendente(id: string, dados: DadosRecusa, cliente: ClienteDb = db): Promise<boolean> {
  const { count } = await cliente.solicitacao.updateMany({
    where: { id, status: "pendente" },
    data: { status: "recusada", ...dados },
  });
  return count === 1;
}

export type DadosCancelamento = {
  canceladaPorId: string;
  canceladaEm: Date;
};

/**
 * Marca como `cancelada` só se a solicitação ainda estiver no status que o service leu
 * (`pendente` ou `aceita`). Devolve `false` se mudou nesse meio tempo.
 */
export async function cancelarSeStatus(
  id: string,
  statusEsperado: Extract<StatusSolicitacao, "pendente" | "aceita">,
  dados: DadosCancelamento,
  cliente: ClienteDb = db,
): Promise<boolean> {
  const { count } = await cliente.solicitacao.updateMany({
    where: { id, status: statusEsperado },
    data: { status: "cancelada", ...dados },
  });
  return count === 1;
}

/** Soma a quantidade de volta ao item (incremento atômico) e devolve como ele ficou. */
export function devolverQuantidade(
  itemId: string,
  quantidade: number,
  cliente: ClienteDb = db,
): Promise<{ quantidadeDisponivel: number; quantidadeTotal: number; status: "disponivel" | "esgotado" | "arquivado" }> {
  return cliente.item.update({
    where: { id: itemId },
    data: { quantidadeDisponivel: { increment: quantidade } },
    select: { quantidadeDisponivel: true, quantidadeTotal: true, status: true },
  });
}

export function atualizarTotalEStatusDoItem(
  itemId: string,
  dados: { quantidadeTotal: number; status: "disponivel" | "esgotado" | "arquivado" },
  cliente: ClienteDb = db,
): Promise<unknown> {
  return cliente.item.update({ where: { id: itemId }, data: dados });
}

export type DadosConclusao = {
  custoFrete: number;
  concluidaPorId: string;
  concluidaEm: Date;
};

/** Marca como `concluida` só se ainda estiver `aceita`. Devolve `false` se mudou nesse meio tempo. */
export async function concluirSeAceita(id: string, dados: DadosConclusao, cliente: ClienteDb = db): Promise<boolean> {
  const { count } = await cliente.solicitacao.updateMany({
    where: { id, status: "aceita" },
    data: { status: "concluida", ...dados },
  });
  return count === 1;
}

/**
 * Cancela as solicitações `pendentes` que envolvem a UT, como origem (item da UT) ou como
 * destino (pedido feito pela UT), sem autor (cancelamento automático). As `aceitas` seguem.
 * Devolve as solicitações canceladas, para o service notificar.
 */
export async function cancelarPendentesDaUt(
  utId: string,
  canceladaEm: Date,
  cliente: ClienteDb = db,
): Promise<Array<{ id: string; solicitanteId: string; itemNome: string }>> {
  const pendentes = await cliente.solicitacao.findMany({
    where: { status: "pendente", OR: [{ utDestinoId: utId }, { item: { utId } }] },
    select: { id: true, solicitanteId: true, item: { select: { nome: true } } },
  });
  if (pendentes.length === 0) return [];

  await cliente.solicitacao.updateMany({
    where: { id: { in: pendentes.map((p) => p.id) }, status: "pendente" },
    data: { status: "cancelada", canceladaEm },
  });
  return pendentes.map((p) => ({ id: p.id, solicitanteId: p.solicitanteId, itemNome: p.item.nome }));
}

const incluirParaLista = {
  item: {
    select: {
      id: true,
      nome: true,
      marca: true,
      modelo: true,
      rm: true,
      unidade: true,
      utId: true,
      valorUnitarioReposicao: true,
      ut: { select: { id: true, nome: true, cidade: true, uf: true } },
      fotos: { select: { chaveThumb: true }, orderBy: { ordem: "asc" }, take: 1 },
    },
  },
  utDestino: { select: { id: true, nome: true, cidade: true, uf: true } },
  solicitante: { select: { id: true, name: true, email: true, telefone: true } },
  respondidaPor: { select: { name: true, email: true, telefone: true } },
} satisfies Prisma.SolicitacaoInclude;

export type SolicitacaoParaLista = Prisma.SolicitacaoGetPayload<{ include: typeof incluirParaLista }>;

/** Limite de linhas por aba; a paginação fica para depois do MVP. */
export const LIMITE_LISTA = 200;

/** Enviadas pela UT (a UT de destino é a do solicitante), mais recentes primeiro. */
export function listarEnviadasPelaUt(utId: string, cliente: ClienteDb = db): Promise<SolicitacaoParaLista[]> {
  return cliente.solicitacao.findMany({
    where: { utDestinoId: utId },
    include: incluirParaLista,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: LIMITE_LISTA,
  });
}

/** Pedidos aos itens da UT, mais recentes primeiro. */
export function listarRecebidasPelaUt(utId: string, cliente: ClienteDb = db): Promise<SolicitacaoParaLista[]> {
  return cliente.solicitacao.findMany({
    where: { item: { utId } },
    include: incluirParaLista,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: LIMITE_LISTA,
  });
}

/** Quantas solicitações `pendentes` cada item tem (itens sem pendentes não aparecem no mapa). */
export async function contarPendentesPorItem(
  itemIds: string[],
  cliente: ClienteDb = db,
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const grupos = await cliente.solicitacao.groupBy({
    by: ["itemId"],
    where: { itemId: { in: itemIds }, status: "pendente" },
    _count: { _all: true },
  });
  return Object.fromEntries(grupos.map((g) => [g.itemId, g._count._all]));
}
