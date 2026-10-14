import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

import type {
  ItemCadastradoBase,
  ItemDisponivelBase,
  TransferenciaBase,
  UtBase,
} from "./dashboard.regras";
import type { CategoriaItem } from "@/modules/itens/itens.schemas";

// Leituras do dashboard (SPEC §6.5). Devolve registros simples (`Decimal` já convertido em
// `number`); as contas ficam em `dashboard.regras.ts`. Só Prisma, sem SQL cru (portabilidade MySQL):
// os agrupamentos que o Prisma não faz (quantidade × valor) são somados em memória no service.

export type FiltroDados = { utId: string | null; categoria: CategoriaItem | null };

const selecionarUt = { id: true, nome: true, cidade: true, uf: true } as const;

/** Itens `disponivel` de UTs ativas: o mesmo recorte da vitrine. Não depende do período. */
export async function listarItensDisponiveis(
  filtro: FiltroDados,
  cliente: ClienteDb = db,
): Promise<ItemDisponivelBase[]> {
  const itens = await cliente.item.findMany({
    where: {
      status: "disponivel",
      ut: { ativo: true },
      ...(filtro.utId ? { utId: filtro.utId } : {}),
      ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
    },
    select: {
      categoria: true,
      quantidadeDisponivel: true,
      valorUnitarioReposicao: true,
      ut: { select: selecionarUt },
    },
  });

  return itens.map((item) => ({
    ut: item.ut,
    categoria: item.categoria,
    quantidadeDisponivel: item.quantidadeDisponivel,
    valorUnitarioReposicao: item.valorUnitarioReposicao.toNumber(),
  }));
}

/** Itens cadastrados desde `desde` (qualquer status): base da taxa e do "valor cadastrado". */
export async function listarItensCadastradosDesde(
  desde: Date,
  filtro: FiltroDados,
  cliente: ClienteDb = db,
): Promise<ItemCadastradoBase[]> {
  const itens = await cliente.item.findMany({
    where: {
      criadoEm: { gte: desde },
      ...(filtro.utId ? { utId: filtro.utId } : {}),
      ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
    },
    select: { criadoEm: true, quantidadeTotal: true, valorUnitarioReposicao: true },
  });

  return itens.map((item) => ({
    criadoEm: item.criadoEm,
    quantidadeTotal: item.quantidadeTotal,
    valorUnitarioReposicao: item.valorUnitarioReposicao.toNumber(),
  }));
}

/**
 * Solicitações `concluida` com `concluida_em` no intervalo. Com filtro de UT entram as
 * transferências em que a UT é origem (dona do item) ou destino (quem pediu).
 */
export async function listarTransferenciasConcluidas(
  inicio: Date,
  fim: Date,
  filtro: FiltroDados,
  cliente: ClienteDb = db,
): Promise<TransferenciaBase[]> {
  const where: Prisma.SolicitacaoWhereInput = {
    status: "concluida",
    concluidaEm: { gte: inicio, lte: fim },
    ...(filtro.categoria ? { item: { categoria: filtro.categoria } } : {}),
    ...(filtro.utId ? { OR: [{ item: { utId: filtro.utId } }, { utDestinoId: filtro.utId }] } : {}),
  };

  const solicitacoes = await cliente.solicitacao.findMany({
    where,
    select: {
      quantidade: true,
      valorUnitarioSnapshot: true,
      custoFrete: true,
      concluidaEm: true,
      utDestino: { select: selecionarUt },
      item: { select: { criadoEm: true, valorUnitarioReposicao: true, ut: { select: selecionarUt } } },
    },
  });

  return solicitacoes.flatMap((s) =>
    s.concluidaEm
      ? [
          {
            origem: s.item.ut,
            destino: s.utDestino,
            quantidade: s.quantidade,
            // Concluída sempre passou pelo aceite (snapshot gravado); o fallback é só defensivo.
            valorUnitarioSnapshot: (s.valorUnitarioSnapshot ?? s.item.valorUnitarioReposicao).toNumber(),
            custoFrete: s.custoFrete.toNumber(),
            concluidaEm: s.concluidaEm,
            itemCriadoEm: s.item.criadoEm,
          },
        ]
      : [],
  );
}

/** UTs ativas para o filtro, mais a `utIdSelecionada` mesmo se estiver inativa (histórico). */
export function listarUtsParaFiltro(utIdSelecionada: string | null, cliente: ClienteDb = db): Promise<UtBase[]> {
  return cliente.ut.findMany({
    where: { OR: [{ ativo: true }, ...(utIdSelecionada ? [{ id: utIdSelecionada }] : [])] },
    select: selecionarUt,
    orderBy: [{ nome: "asc" }, { codigo: "asc" }],
  });
}
